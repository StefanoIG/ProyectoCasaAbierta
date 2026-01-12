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
# VALIDACIÓN DE RECETAS
# ============================================
def validate_recipe(recipe_data):
    """Valida que la receta existe y tiene todos los ingredientes disponibles"""
    config = load_config()
    if not config:
        return False, "Error cargando configuración"
    
    recipe_id = recipe_data.get('recipe_id')
    pumps_data = recipe_data.get('pumps', {})
    
    # Verificar que la receta existe en pi.json
    recipes = config.get('recipes', {})
    if recipe_id not in recipes:
        return False, f"Receta '{recipe_id}' no existe en la configuración"
    
    # Verificar que todos los ingredientes están disponibles
    available_pumps = config.get('pumps', {})
    recipe_ingredients = recipes[recipe_id]['ingredients']
    
    for ingredient, ml in recipe_ingredients.items():
        # Buscar si hay una bomba con ese ingrediente
        found = False
        for pump_id, pump_info in available_pumps.items():
            if pump_info['value'] == ingredient:
                found = True
                break
        
        if not found:
            return False, f"Ingrediente '{ingredient}' no disponible en las bombas"
    
    # Verificar que el payload tiene las bombas correctas
    if not pumps_data:
        return False, "No se especificaron bombas en el payload"
    
    return True, "Receta válida"

# ============================================
# FUNCIÓN DE VERTIDO
# ============================================
def verter(pin, ml, ingredient_name):
    """Activa una bomba específica por el tiempo calculado"""
    config = load_config()
    flow_rate = config.get('config', {}).get('flow_rate', 0.6)
    tiempo = ml * flow_rate
    
    print(f"  🚰 Vertiendo {ml}ml de {ingredient_name} (PIN {pin}, {tiempo:.1f}s)")
    GPIO.output(pin, GPIO.LOW)   # Encender bomba
    time.sleep(tiempo)
    GPIO.output(pin, GPIO.HIGH)  # Apagar bomba

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
            print(f"   Posición en cola: {pedidos_queue.qsize() + 1}")
            print(f"{'='*60}\n")
            
            config = load_config()
            max_time = config.get('config', {}).get('max_preparation_time', 30)
            cleanup_delay = config.get('config', {}).get('cleanup_delay', 2)
            
            start_time = time.time()
            
            # Procesar cada bomba
            for pump_id, pump_data in pedido['pumps'].items():
                # Verificar timeout de 30 segundos
                elapsed = time.time() - start_time
                if elapsed > max_time:
                    print(f"⚠️  TIMEOUT: Se alcanzó el límite de {max_time}s")
                    break
                
                pin = pump_data['gpio_pin']
                ml = pump_data['ml']
                ingredient = pump_data['ingredient']
                
                verter(pin, ml, ingredient)
                time.sleep(cleanup_delay)  # Pausa entre bombas
            
            total_time = time.time() - start_time
            print(f"\n{'='*60}")
            print(f"✅ COMPLETADO: {pedido['recipe_name']}")
            print(f"   Tiempo total: {total_time:.1f}s")
            print(f"   Pedidos restantes: {pedidos_queue.qsize()}")
            print(f"{'='*60}\n")
            
        except Exception as e:
            print(f"❌ Error procesando pedido: {e}")
        
        finally:
            with preparando_lock:
                preparando = False
            pedidos_queue.task_done()

# ============================================
# ENDPOINTS FLASK
# ============================================
@app.route('/hacer_trago', methods=['POST'])
def hacer_trago():
    """Endpoint principal para recibir pedidos de cócteles"""
    global preparando
    
    try:
        datos = request.json
        
        if not datos:
            return jsonify({
                'status': 'error',
                'mensaje': 'No se recibieron datos'
            }), 400
        
        print(f"\n📥 Pedido recibido: {datos.get('recipe_name', 'Desconocido')}")
        
        # Validar receta
        is_valid, mensaje = validate_recipe(datos)
        if not is_valid:
            print(f"❌ Validación fallida: {mensaje}")
            return jsonify({
                'status': 'error',
                'mensaje': mensaje
            }), 400
        
        # Agregar a la cola
        posicion = pedidos_queue.qsize() + 1
        pedidos_queue.put(datos)
        
        with preparando_lock:
            estado_actual = "preparando" if preparando else "en cola"
        
        print(f"✓ Pedido agregado a la cola (posición {posicion})")
        
        return jsonify({
            'status': 'success',
            'mensaje': f"{datos['recipe_name']} agregado a la cola",
            'posicion_cola': posicion,
            'estado': estado_actual,
            'tiempo_estimado': f"{posicion * 30}s"
        }), 200
        
    except Exception as e:
        print(f"❌ Error en endpoint: {e}")
        return jsonify({
            'status': 'error',
            'mensaje': str(e)
        }), 500

@app.route('/estado', methods=['GET'])
def get_estado():
    """Endpoint para consultar el estado del sistema"""
    with preparando_lock:
        estado = "preparando" if preparando else "disponible"
    
    return jsonify({
        'estado': estado,
        'pedidos_en_cola': pedidos_queue.qsize(),
        'tiempo_estimado': f"{pedidos_queue.qsize() * 30}s"
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'online',
        'timestamp': datetime.now().isoformat()
    }), 200

# ============================================
# INICIALIZACIÓN
# ============================================
if __name__ == '__main__':
    print("\n" + "="*60)
    print("🍹 SISTEMA DE BARMAN AUTOMÁTICO - INICIANDO")
    print("="*60 + "\n")
    
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