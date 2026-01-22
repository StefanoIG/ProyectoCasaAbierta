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

# Cola de pedidos y locks
pedidos_queue = Queue()
preparando = False
preparando_lock = threading.Lock()

# ============================================
# ⚙️ CALIBRACIÓN CORREGIDA (VOLUMEN REAL)
# ============================================
# Ahora usamos flow_rate directamente del JSON
CALIBRACION_POR_PIN = {
    17: 10.0 / 37.0,  # Ron: 3.7 ml/s → 10s/37ml
    27: 10.0 / 38.0,  # Mix Limón: 3.8 ml/s
    22: 10.0 / 35.0,  # Gin: 3.5 ml/s
    24: 10.0 / 40.0,  # Jugo Naranja: 4.0 ml/s
    25: 10.0 / 21.0,  # Vodka: 2.1 ml/s
    23: 10.0 / 20.0   # Tequila: 2.0 ml/s
}

DEFAULT_RATE = 10.0 / 30.0

# ============================================
# FUNCIONES AUXILIARES
# ============================================
def load_config():
    """Lee el archivo pi.json con el nuevo formato"""
    try:
        with open('pi.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error leyendo pi.json: {e}")
        return None

def setup_gpio():
    """Configura los pines basándose en config.json"""
    config = load_config()
    if not config: return False
    
    pumps = config.get('config', {})
    print("\n🔌 Configurando Pines GPIO:")
    
    for pump_key, pump_info in pumps.items():
        pin = pump_info["pin"]
        GPIO.setup(pin, GPIO.OUT)
        GPIO.output(pin, GPIO.HIGH)  # Apagado inicial
        
        # Calculamos calibración desde flow_rate
        flow_rate = pump_info.get('flow_rate', 3.0)
        rate = 1.0 / flow_rate  # segundos por ml
        
        # Actualizamos el diccionario de calibración
        CALIBRACION_POR_PIN[pin] = rate
        
        print(f"   ✓ {pump_info['label']} (Pin {pin}) -> {flow_rate} ml/s ({rate:.4f} seg/ml)")
        
    return True

# ============================================
# LÓGICA DE PREPARACIÓN
# ============================================
def prepare_preparation_plan(recipe_id):
    """
    Convierte un ID de receta en una lista de instrucciones.
    Ahora trabaja con el nuevo formato de menu e ingredientes.
    """
    config = load_config()
    if not config: return None, "Error de Config"
    
    # 1. Buscar Receta por ID
    menu = config.get('menu', [])
    recipe = None
    
    for item in menu:
        if item['id'] == recipe_id:
            recipe = item
            break
    
    if not recipe:
        return None, f"Receta con ID {recipe_id} no encontrada"
    
    ingredients_list = recipe['ingredients']
    plan = []
    available_pumps = config.get('config', {})
    
    # 2. Procesar cada ingrediente
    for ingredient in ingredients_list:
        pump_id = ingredient['pump']  # Ej: "pump_6"
        amount_ml = ingredient['ml']
        
        # Buscar info de la bomba
        if pump_id not in available_pumps:
            return None, f"Bomba '{pump_id}' no configurada"
        
        pump_info = available_pumps[pump_id]
        pin = pump_info['pin']
        label = pump_info['label']
        
        # 3. Calcular tiempo usando calibración
        rate = CALIBRACION_POR_PIN.get(pin, DEFAULT_RATE)
        duration = amount_ml * rate
        
        plan.append({
            "name": label,
            "pin": pin,
            "amount": amount_ml,
            "duration": duration,
            "rate_used": rate
        })
    
    return plan, recipe['name']

def verter(pin, duration, name):
    """Activa el relé por el tiempo especificado"""
    print(f"   Running PIN {pin} ({name}) por {duration:.2f}s...")
    GPIO.output(pin, GPIO.LOW)  # ON
    time.sleep(duration)
    GPIO.output(pin, GPIO.HIGH)  # OFF

# ============================================
# HILO DE TRABAJO (WORKER)
# ============================================
def procesar_pedidos():
    global preparando
    
    while True:
        try:
            job = pedidos_queue.get()
            
            with preparando_lock:
                preparando = True
                
            recipe_name = job['recipe_name']
            instructions = job['instructions']
            
            print(f"\n{'='*50}")
            print(f"🍹 INICIANDO: {recipe_name}")
            print(f"{'='*50}")
            
            start_total = time.time()
            
            for i, step in enumerate(instructions):
                if step['amount'] > 0:
                    msg = f"Sirviendo {step['amount']}ml de {step['name']}"
                else:
                    msg = f"Prueba manual de {step['name']}"

                print(f"[{i+1}/{len(instructions)}] {msg} (Tiempo: {step['duration']:.2f}s)...")
                
                verter(step['pin'], step['duration'], step['name'])
                
                if i < len(instructions) - 1:
                    time.sleep(0.5)
            
            total_time = time.time() - start_total
            print(f"\n✅ {recipe_name} LISTO en {total_time:.2f}s")
            print(f"{'='*50}\n")
            
        except Exception as e:
            print(f"❌ Error en worker: {e}")
            
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
    Ahora recibe el ID numérico de la receta
    Payload: {"recipe_id": 1}
    """
    data = request.json
    recipe_id = data.get('recipe_id')
    
    if recipe_id is None:
        return jsonify({"status": "error", "mensaje": "Falta recipe_id"}), 400
    
    try:
        recipe_id = int(recipe_id)
    except ValueError:
        return jsonify({"status": "error", "mensaje": "recipe_id debe ser un número"}), 400
        
    print(f"📥 Petición recibida: Recipe ID {recipe_id}")
    
    instructions, result_name = prepare_preparation_plan(recipe_id)
    
    if not instructions:
        return jsonify({"status": "error", "mensaje": result_name}), 400
    
    total_est = sum(step['duration'] for step in instructions) + (len(instructions) * 0.5)
    
    job = {
        "recipe_name": result_name,
        "instructions": instructions,
        "timestamp": time.time()
    }
    pedidos_queue.put(job)
    
    return jsonify({
        "status": "success",
        "mensaje": f"Marchando un {result_name}",
        "tiempo_estimado": f"{total_est:.1f}s",
        "cola": pedidos_queue.qsize()
    })

@app.route('/menu', methods=['GET'])
def obtener_menu():
    """Devuelve el menú completo de tragos disponibles"""
    config = load_config()
    if not config:
        return jsonify({"status": "error", "mensaje": "Error cargando configuración"}), 500
    
    return jsonify({
        "status": "success",
        "menu": config.get('menu', [])
    })

@app.route('/prueba_manual', methods=['POST'])
def prueba_manual():
    """
    Recibe una lista de bombas y segundos para activar manualmente.
    Payload: {"acciones": [{"pin": 17, "segundos": 2}]}
    """
    data = request.json
    acciones = data.get('acciones', [])
    
    if not acciones or not isinstance(acciones, list):
        return jsonify({"status": "error", "mensaje": "Se requiere una lista de 'acciones'"}), 400
    
    instructions = []
    total_time_est = 0
    
    for item in acciones:
        try:
            pin = int(item.get('pin'))
            secs = float(item.get('segundos'))
            
            if secs <= 0: continue
            
            instructions.append({
                "name": f"TEST_PIN_{pin}",
                "pin": pin,
                "amount": 0,
                "duration": secs,
                "rate_used": 0
            })
            total_time_est += secs
            
        except (ValueError, TypeError):
            continue
            
    if not instructions:
        return jsonify({"status": "error", "mensaje": "No hay acciones válidas"}), 400
        
    job = {
        "recipe_name": "🛠️ PRUEBA MANUAL",
        "instructions": instructions,
        "timestamp": time.time()
    }
    pedidos_queue.put(job)
    
    return jsonify({
        "status": "success",
        "mensaje": f"Encolando prueba de {len(instructions)} pasos",
        "tiempo_estimado": f"{total_time_est:.1f}s",
        "cola_actual": pedidos_queue.qsize()
    })

@app.route('/estado', methods=['GET'])
def estado():
    with preparando_lock:
        status = "preparando" if preparando else "libre"
    return jsonify({
        "estado": status,
        "cola": pedidos_queue.qsize()
    })

@app.route('/calibracion', methods=['GET'])
def ver_calibracion():
    """Muestra la calibración actual de todas las bombas"""
    config = load_config()
    if not config:
        return jsonify({"status": "error"}), 500
    
    calibracion_info = {}
    for pump_id, pump_data in config.get('config', {}).items():
        pin = pump_data['pin']
        calibracion_info[pump_id] = {
            "label": pump_data['label'],
            "pin": pin,
            "flow_rate_ml_s": pump_data.get('flow_rate', 0),
            "segundos_por_ml": CALIBRACION_POR_PIN.get(pin, DEFAULT_RATE)
        }
    
    return jsonify(calibracion_info)

# ============================================
# MAIN
# ============================================
if __name__ == '__main__':
    try:
        print("\n--- INICIANDO BARTENDER IA (NUEVO FORMATO) ---")
        if setup_gpio():
            t = threading.Thread(target=procesar_pedidos, daemon=True)
            t.start()
            app.run(host='0.0.0.0', port=5000, debug=False)
        else:
            print("Error fatal en configuración GPIO")
            
    except KeyboardInterrupt:
        print("\nApagando...")
        GPIO.cleanup()