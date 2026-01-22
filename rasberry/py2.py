import json
import time
import threading
from queue import Queue
from datetime import datetime
import RPi.GPIO as GPIO
from flask import Flask, request, jsonify

# ============================================
# CONFIGURACIÓN GLOBAL
# ============================================
app = Flask(__name__)
GPIO.setmode(GPIO.BCM)

# Cola de pedidos y sistema de estado
pedidos_queue = Queue()
preparando = False
preparando_lock = threading.Lock()

# CALIBRACIÓN: segundos por mililitro
# Ajusta estos valores según tu bomba específica
SEGUNDOS_POR_ML = 0.5  # Por ejemplo: 10ml = 5 segundos, 30ml = 15 segundos

# ============================================
# FUNCIONES DE CONFIGURACIÓN
# ============================================
def load_config():
    """Carga la configuración completa desde pi.json"""
    try:
        with open('pi.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ Error: pi.json no encontrado")
        return None
    except json.JSONDecodeError:
        print("❌ Error: pi.json mal formateado")
        return None

def setup_gpio():
    """Configura los pines GPIO inicialmente"""
    config = load_config()
    if not config:
        return False
    
    pumps = config.get('pumps', {})
    for pump_id, pump_info in pumps.items():
        pin = pump_info["pin"]
        GPIO.setup(pin, GPIO.OUT)
        GPIO.output(pin, GPIO.HIGH)  # Apagado (relés activos en LOW)
        print(f"✓ Configurado {pump_info['name']} en pin {pin}")
    
    return True

# ============================================
# VALIDACIÓN Y PREPARACIÓN DE RECETAS
# ============================================
def validate_and_prepare_recipe(recipe_id):
    """
    Valida que la receta existe y prepara la lista de bombas a activar
    Retorna: (success, data/error_message)
    """
    config = load_config()
    if not config:
        return False, "Error cargando configuración"
    
    # Verificar que la receta existe
    recipes = config.get('recipes', {})
    if recipe_id not in recipes:
        return False, f"Receta '{recipe_id}' no existe en la configuración"
    
    recipe = recipes[recipe_id]
    recipe_name = recipe['name']
    ingredients_needed = recipe['ingredients']  # Dict: {ingrediente: ml}
    
    # Buscar qué bomba tiene cada ingrediente
    available_pumps = config.get('pumps', {})
    pumps_to_activate = []
    
    for ingredient, ml in ingredients_needed.items():
        # Buscar la bomba que tiene este ingrediente
        pump_found = None
        for pump_id, pump_info in available_pumps.items():
            if pump_info['value'] == ingredient:
                pump_found = {
                    'pump_id': pump_id,
                    'gpio_pin': pump_info['pin'],
                    'ingredient': ingredient,
                    'ml': ml,
                    'name': pump_info['name']
                }
                break
        
        if not pump_found:
            return False, f"Ingrediente '{ingredient}' no disponible en ninguna bomba"
        
        pumps_to_activate.append(pump_found)
    
    return True, {
        'recipe_id': recipe_id,
        'recipe_name': recipe_name,
        'pumps': pumps_to_activate,
        'timestamp': datetime.now().isoformat()
    }

# ============================================
# FUNCIÓN DE VERTIDO
# ============================================
def verter(pin, ml, ingredient_name):
    """Activa una bomba específica por el tiempo calculado"""
    tiempo = ml * SEGUNDOS_POR_ML
    
    print(f"  🚰 Vertiendo {ml}ml de {ingredient_name}")
    print(f"     PIN {pin} | Tiempo: {tiempo:.1f}s")
    
    GPIO.output(pin, GPIO.LOW)   # Encender bomba (relé activo en LOW)
    time.sleep(tiempo)
    GPIO.output(pin, GPIO.HIGH)  # Apagar bomba
    
    print(f"  ✓ Completado: {ingredient_name}")

# ============================================
# PROCESADOR DE PEDIDOS (WORKER THREAD)
# ============================================
def procesar_pedidos():
    """Thread worker que procesa pedidos de la cola secuencialmente"""
    global preparando
    
    while True:
        # Esperar por un pedido en la cola
        pedido = pedidos_queue.get()
        
        with preparando_lock:
            preparando = True
        
        try:
            print(f"\n{'='*60}")
            print(f"🍹 INICIANDO PREPARACIÓN: {pedido['recipe_name']}")
            print(f"   Pedido ID: {pedido['timestamp']}")
            print(f"   Ingredientes: {len(pedido['pumps'])}")
            print(f"   Pedidos restantes en cola: {pedidos_queue.qsize()}")
            print(f"{'='*60}\n")
            
            config = load_config()
            max_time = config.get('config', {}).get('max_preparation_time', 60)
            cleanup_delay = config.get('config', {}).get('cleanup_delay', 2)
            
            start_time = time.time()
            
            # Procesar cada bomba en secuencia
            for idx, pump_data in enumerate(pedido['pumps'], 1):
                # Verificar timeout
                elapsed = time.time() - start_time
                if elapsed > max_time:
                    print(f"⚠️  TIMEOUT: Se alcanzó el límite de {max_time}s")
                    break
                
                print(f"\n[{idx}/{len(pedido['pumps'])}] Procesando ingrediente:")
                
                pin = pump_data['gpio_pin']
                ml = pump_data['ml']
                ingredient = pump_data['ingredient']
                
                verter(pin, ml, ingredient)
                
                # Pausa entre ingredientes (excepto después del último)
                if idx < len(pedido['pumps']):
                    print(f"  ⏸️  Pausa de {cleanup_delay}s antes del siguiente ingrediente\n")
                    time.sleep(cleanup_delay)
            
            total_time = time.time() - start_time
            print(f"\n{'='*60}")
            print(f"✅ COMPLETADO: {pedido['recipe_name']}")
            print(f"   Tiempo total: {total_time:.1f}s")
            print(f"   Pedidos restantes: {pedidos_queue.qsize()}")
            print(f"{'='*60}\n")
            
        except Exception as e:
            print(f"❌ Error procesando pedido: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            with preparando_lock:
                preparando = False
            pedidos_queue.task_done()

# ============================================
# ENDPOINTS FLASK
# ============================================
@app.route('/hacer_trago', methods=['POST'])
def hacer_trago():
    """
    Endpoint principal para recibir pedidos de cócteles
    Payload esperado: {"recipe_id": "mojito"}
    """
    global preparando
    
    try:
        datos = request.json
        
        if not datos:
            return jsonify({
                'status': 'error',
                'mensaje': 'No se recibieron datos'
            }), 400
        
        recipe_id = datos.get('recipe_id')
        if not recipe_id:
            return jsonify({
                'status': 'error',
                'mensaje': 'Falta el campo recipe_id'
            }), 400
        
        print(f"\n📥 Pedido recibido: {recipe_id}")
        
        # Validar y preparar la receta completa
        is_valid, result = validate_and_prepare_recipe(recipe_id)
        
        if not is_valid:
            print(f"❌ Validación fallida: {result}")
            return jsonify({
                'status': 'error',
                'mensaje': result
            }), 400
        
        # result ahora contiene toda la info de las bombas a activar
        pedido_completo = result
        
        # Agregar a la cola
        posicion = pedidos_queue.qsize() + 1
        pedidos_queue.put(pedido_completo)
        
        with preparando_lock:
            estado_actual = "preparando" if preparando else "en cola"
        
        # Calcular tiempo estimado
        tiempo_estimado = sum(p['ml'] * SEGUNDOS_POR_ML for p in pedido_completo['pumps'])
        tiempo_estimado += len(pedido_completo['pumps']) * 2  # Agregar pausas
        
        print(f"✓ Pedido '{pedido_completo['recipe_name']}' agregado a la cola")
        print(f"  Posición: {posicion}")
        print(f"  Bombas a activar: {len(pedido_completo['pumps'])}")
        print(f"  Tiempo estimado: {tiempo_estimado:.1f}s")
        
        return jsonify({
            'status': 'success',
            'mensaje': f"{pedido_completo['recipe_name']} agregado a la cola",
            'recipe_name': pedido_completo['recipe_name'],
            'ingredientes': len(pedido_completo['pumps']),
            'posicion_cola': posicion,
            'estado': estado_actual,
            'tiempo_estimado_segundos': round(tiempo_estimado, 1)
        }), 200
        
    except Exception as e:
        print(f"❌ Error en endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'mensaje': str(e)
        }), 500

@app.route('/test_gpio', methods=['POST'])
def test_gpio():
    """
    Endpoint para probar bombas individuales directamente por GPIO
    Payload: {
        "gpio_pin": 25,
        "duration_seconds": 5  (opcional, default 3)
    }
    """
    try:
        datos = request.json
        
        if not datos or 'gpio_pin' not in datos:
            return jsonify({
                'status': 'error',
                'mensaje': 'Falta el campo gpio_pin'
            }), 400
        
        gpio_pin = datos.get('gpio_pin')
        duration = datos.get('duration_seconds', 3)  # Default 3 segundos
        
        # Validar que el pin existe en la configuración
        config = load_config()
        if not config:
            return jsonify({
                'status': 'error',
                'mensaje': 'Error cargando configuración'
            }), 500
        
        # Buscar info del pin
        pumps = config.get('pumps', {})
        pump_info = None
        pump_id = None
        
        for pid, pinfo in pumps.items():
            if pinfo['pin'] == gpio_pin:
                pump_info = pinfo
                pump_id = pid
                break
        
        if not pump_info:
            return jsonify({
                'status': 'error',
                'mensaje': f'GPIO {gpio_pin} no está configurado en ninguna bomba'
            }), 400
        
        print(f"\n{'='*60}")
        print(f"🧪 PRUEBA DE GPIO")
        print(f"   Pin: {gpio_pin}")
        print(f"   Bomba: {pump_info['name']}")
        print(f"   Ingrediente: {pump_info['value']}")
        print(f"   Duración: {duration}s")
        print(f"{'='*60}\n")
        
        # Activar bomba directamente
        print(f"🚰 Activando {pump_info['name']}...")
        GPIO.output(gpio_pin, GPIO.LOW)   # Encender
        time.sleep(duration)
        GPIO.output(gpio_pin, GPIO.HIGH)  # Apagar
        print(f"✅ Prueba completada\n")
        
        return jsonify({
            'status': 'success',
            'mensaje': 'Prueba de GPIO completada',
            'gpio_pin': gpio_pin,
            'pump_id': pump_id,
            'pump_name': pump_info['name'],
            'ingredient': pump_info['value'],
            'duration_seconds': duration
        }), 200
        
    except Exception as e:
        print(f"❌ Error en test_gpio: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'mensaje': str(e)
        }), 500

@app.route('/test_all_gpios', methods=['POST'])
def test_all_gpios():
    """
    Endpoint para probar TODAS las bombas secuencialmente
    Payload: {
        "duration_seconds": 3  (opcional, default 3)
    }
    """
    try:
        datos = request.json if request.json else {}
        duration = datos.get('duration_seconds', 3)
        
        config = load_config()
        if not config:
            return jsonify({
                'status': 'error',
                'mensaje': 'Error cargando configuración'
            }), 500
        
        pumps = config.get('pumps', {})
        
        print(f"\n{'='*60}")
        print(f"🧪 PRUEBA DE TODAS LAS BOMBAS")
        print(f"   Duración por bomba: {duration}s")
        print(f"   Total de bombas: {len(pumps)}")
        print(f"{'='*60}\n")
        
        results = []
        
        for idx, (pump_id, pump_info) in enumerate(pumps.items(), 1):
            pin = pump_info['pin']
            name = pump_info['name']
            
            print(f"[{idx}/{len(pumps)}] 🚰 Probando {name} (GPIO {pin})...")
            
            try:
                GPIO.output(pin, GPIO.LOW)
                time.sleep(duration)
                GPIO.output(pin, GPIO.HIGH)
                
                results.append({
                    'pump_id': pump_id,
                    'gpio_pin': pin,
                    'name': name,
                    'status': 'ok'
                })
                print(f"            ✅ Completado\n")
                
                # Pausa entre bombas (excepto la última)
                if idx < len(pumps):
                    time.sleep(1)
                
            except Exception as e:
                results.append({
                    'pump_id': pump_id,
                    'gpio_pin': pin,
                    'name': name,
                    'status': 'error',
                    'error': str(e)
                })
                print(f"            ❌ Error: {e}\n")
        
        print(f"{'='*60}")
        print("✅ PRUEBA COMPLETADA")
        print(f"{'='*60}\n")
        
        return jsonify({
            'status': 'success',
            'mensaje': 'Prueba de todas las bombas completada',
            'duration_per_pump': duration,
            'results': results
        }), 200
        
    except Exception as e:
        print(f"❌ Error en test_all_gpios: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'mensaje': str(e)
        }), 500

@app.route('/estado', methods=['GET'])
def get_estado():
    """Endpoint para consultar el estado del sistema"""
    with preparando_lock:
        estado = "preparando" if preparando else "disponible"
    
    config = load_config()
    pumps = config.get('pumps', {}) if config else {}
    
    return jsonify({
        'estado': estado,
        'pedidos_en_cola': pedidos_queue.qsize(),
        'bombas_configuradas': len(pumps),
        'calibracion_sg_por_ml': SEGUNDOS_POR_ML
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'online',
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/calibracion', methods=['GET'])
def get_calibracion():
    """Endpoint para consultar la calibración actual"""
    return jsonify({
        'segundos_por_ml': SEGUNDOS_POR_ML,
        'ejemplos': {
            '10ml': f"{10 * SEGUNDOS_POR_ML}s",
            '30ml': f"{30 * SEGUNDOS_POR_ML}s",
            '50ml': f"{50 * SEGUNDOS_POR_ML}s",
            '100ml': f"{100 * SEGUNDOS_POR_ML}s"
        }
    }), 200

# ============================================
# INICIALIZACIÓN
# ============================================
if __name__ == '__main__':
    print("\n" + "="*60)
    print("🍹 SISTEMA DE BARMAN AUTOMÁTICO - INICIANDO")
    print("="*60 + "\n")
    
    print(f"⚙️  CALIBRACIÓN: {SEGUNDOS_POR_ML}s por ml")
    print(f"   Ejemplos: 10ml={10*SEGUNDOS_POR_ML}s | 30ml={30*SEGUNDOS_POR_ML}s | 50ml={50*SEGUNDOS_POR_ML}s\n")
    
    # Configurar GPIO
    if not setup_gpio():
        print("❌ Error configurando GPIO. Abortando.")
        exit(1)
    
    # Iniciar worker thread para procesar pedidos
    worker_thread = threading.Thread(target=procesar_pedidos, daemon=True)
    worker_thread.start()
    print("✓ Worker thread iniciado\n")
    
    print("🌐 Servidor Flask iniciando en 0.0.0.0:5000")
    print("="*60 + "\n")
    
    try:
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\n\n🛑 Deteniendo servidor...")
        GPIO.cleanup()
        print("✓ GPIO limpiado. Adiós!\n")