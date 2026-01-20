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
# Interpretación: Los valores del Excel (ej. 0.35) son en realidad 35ml.
# Fórmula: 10.0 segundos / XX ml

CALIBRACION_POR_PIN = {
    # Bomba 1 (Pin 17): Promedio ~35 ml en 10s
    # Factor: 0.285 seg/ml
    17: 10.0 / 35.0, 
    
    # Bomba 2 (Pin 27): Promedio ~38 ml en 10s
    # Factor: 0.263 seg/ml
    27: 10.0 / 38.0,
    
    # Bomba 3 (Pin 22): Promedio ~35 ml en 10s
    # Factor: 0.285 seg/ml
    22: 10.0 / 35.0,
    
    # Bomba 4 (Pin 24): Promedio ~40 ml en 10s (La más rápida)
    # Factor: 0.25 seg/ml
    24: 10.0 / 40.0,
    
    # Bomba 5 (Pin 25): Promedio ~22 ml en 10s
    # Factor: 0.45 seg/ml
    25: 10.0 / 22.0,
    
    # Bomba 6 (Pin 23): Promedio ~20 ml en 10s (La más lenta)
    # Factor: 0.50 seg/ml
    23: 10.0 / 20.0    
}

# Valor por defecto (30ml en 10s)
DEFAULT_RATE = 10.0 / 30.0

# ============================================
# FUNCIONES AUXILIARES
# ============================================
def load_config():
    """Lee el archivo pi.json para sacar recetas y configuración"""
    try:
        with open('pi.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error leyendo pi.json: {e}")
        return None

def setup_gpio():
    """Configura los pines basándose en pi.json"""
    config = load_config()
    if not config: return False
    
    pumps = config.get('pumps', {})
    print("\n🔌 Configurando Pines GPIO:")
    
    for pump_key, pump_info in pumps.items():
        pin = pump_info["pin"]
        GPIO.setup(pin, GPIO.OUT)
        GPIO.output(pin, GPIO.HIGH) # Apagado inicial
        
        # Mostramos la calibración cargada para esa bomba
        rate = CALIBRACION_POR_PIN.get(pin, DEFAULT_RATE)
        print(f"   ✓ {pump_info['name']} (Pin {pin}) -> Calibración: {rate:.4f} seg/ml")
        
    return True

# ============================================
# LÓGICA DE PREPARACIÓN
# ============================================
def prepare_preparation_plan(recipe_id):
    """
    Convierte un ID de receta en una lista de instrucciones.
    """
    config = load_config()
    if not config: return None, "Error de Config"
    
    # 1. Buscar Receta
    recipes = config.get('recipes', {})
    if recipe_id not in recipes:
        return None, f"Receta '{recipe_id}' no encontrada"
    
    recipe = recipes[recipe_id]
    ingredients_needed = recipe['ingredients'] 
    
    plan = []
    available_pumps = config.get('pumps', {})
    
    # 2. Mapear Ingredientes a Bombas
    for ingredient_name, amount_needed in ingredients_needed.items():
        pump_match = None
        
        # Buscar qué bomba tiene el ingrediente
        for p_id, p_info in available_pumps.items():
            if p_info['value'] == ingredient_name:
                pump_match = p_info
                break
        
        if not pump_match:
            return None, f"Falta botella de: {ingredient_name}"
        
        pin = pump_match['pin']
        
        # 3. CÁLCULO DE TIEMPO (AHORA CORREGIDO)
        rate = CALIBRACION_POR_PIN.get(pin, DEFAULT_RATE)
        duration = amount_needed * rate
        
        plan.append({
            "name": ingredient_name,
            "pin": pin,
            "amount": amount_needed,
            "duration": duration,
            "rate_used": rate
        })
        
    return plan, recipe['name']

def verter(pin, duration, name):
    """Activa el relé por el tiempo especificado"""
    print(f"   Running PIN {pin} ({name}) por {duration:.2f}s...")
    GPIO.output(pin, GPIO.LOW)  # ON
    time.sleep(duration)
    GPIO.output(pin, GPIO.HIGH) # OFF

# ============================================
# HILO DE TRABAJO (WORKER)
# ============================================
def procesar_pedidos():
    global preparando
    
    while True:
        try:
            # Esperamos pedido (bloqueante)
            job = pedidos_queue.get()
            
            with preparando_lock:
                preparando = True
                
            recipe_name = job['recipe_name']
            instructions = job['instructions']
            
            print(f"\n{'='*50}")
            print(f"🍹 INICIANDO: {recipe_name}")
            print(f"{'='*50}")
            
            start_total = time.time()
            
            # Ejecutamos instrucción por instrucción
            for i, step in enumerate(instructions):
                if step['amount'] > 0:
                    msg = f"Sirviendo {step['amount']}ml de {step['name']}"
                else:
                    msg = f"Prueba manual de {step['name']}"

                print(f"[{i+1}/{len(instructions)}] {msg} (Tiempo: {step['duration']:.2f}s)...")
                
                verter(step['pin'], step['duration'], step['name'])
                
                # Pausa técnica entre bombas
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
    data = request.json
    recipe_id = data.get('recipe_id') 
    
    if not recipe_id:
        return jsonify({"status": "error", "mensaje": "Falta recipe_id"}), 400
        
    print(f"📥 Petición recibida: {recipe_id}")
    
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
    return jsonify(CALIBRACION_POR_PIN)

# ============================================
# MAIN
# ============================================
if __name__ == '__main__':
    try:
        print("\n--- INICIANDO BARTENDER IA (CALIBRACIÓN CORREGIDA) ---")
        if setup_gpio():
            t = threading.Thread(target=procesar_pedidos, daemon=True)
            t.start()
            app.run(host='0.0.0.0', port=5000, debug=False)
        else:
            print("Error fatal en configuración GPIO")
            
    except KeyboardInterrupt:
        print("\nApagando...")
        GPIO.cleanup()
