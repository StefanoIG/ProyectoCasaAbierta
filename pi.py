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
# ⚙️ CALIBRACIÓN INDIVIDUAL (BASADA EN TU EXCEL)
# ============================================
# Calculamos "Segundos por 1 Unidad" usando tu regla de 3:
# Fórmula: 10 segundos / Cantidad promedio del Excel
# Esto hace que las bombas lentas (como la 6) se queden prendidas más tiempo automáticamente.

CALIBRACION_POR_PIN = {
    # Bomba 1 (Pin 17): Promedio ~0.35 -> 10 / 0.35 = 28.57 seg/unidad
    17: 10.0 / 0.35, 
    
    # Bomba 2 (Pin 27): Promedio ~0.38 -> 10 / 0.38 = 26.31 seg/unidad
    27: 10.0 / 0.38,
    
    # Bomba 3 (Pin 22): Promedio ~0.35 -> 10 / 0.35 = 28.57 seg/unidad
    22: 10.0 / 0.35,
    
    # Bomba 4 (Pin 24): Promedio ~0.40 (La más rápida) -> 25.0 seg/unidad
    24: 10.0 / 0.40,
    
    # Bomba 5 (Pin 25): Promedio ~0.22 -> 45.45 seg/unidad
    25: 10.0 / 0.22,
    
    # Bomba 6 (Pin 23): Promedio ~0.20 (La más lenta) -> 50.0 seg/unidad
    23: 10.0 / 0.20   
}

# Valor por defecto si conectas una bomba nueva no calibrada
DEFAULT_RATE = 30.0 

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
        print(f"   ✓ {pump_info['name']} (Pin {pin}) -> Calibración: {rate:.1f} seg/ml")
        
    return True

# ============================================
# LÓGICA DE PREPARACIÓN
# ============================================
def prepare_preparation_plan(recipe_id):
    """
    Convierte un ID de receta en una lista de instrucciones para las bombas.
    Calcula los tiempos exactos usando la calibración individual.
    """
    config = load_config()
    if not config: return None, "Error de Config"
    
    # 1. Buscar Receta
    recipes = config.get('recipes', {})
    if recipe_id not in recipes:
        return None, f"Receta '{recipe_id}' no encontrada"
    
    recipe = recipes[recipe_id]
    ingredients_needed = recipe['ingredients'] # Ej: {"ron": 50, "cola": 100}
    
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
        
        # 3. CÁLCULO MAGISTRAL DE TIEMPO
        # Usamos la calibración específica de este PIN
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
    print(f"   Running PIN {pin} ({name}) por {duration:.1f}s...")
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
            # NO HAY TIMEOUT GLOBAL: Si son 6 bombas, espera a las 6.
            for i, step in enumerate(instructions):
                print(f"[{i+1}/{len(instructions)}] Sirviendo {step['amount']} de {step['name']}...")
                
                verter(step['pin'], step['duration'], step['name'])
                
                # Pausa técnica para evitar caída de voltaje si la fuente es débil
                if i < len(instructions) - 1:
                    time.sleep(1.0) 
            
            total_time = time.time() - start_total
            print(f"\n✅ {recipe_name} LISTO en {total_time:.1f}s")
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
    recipe_id = data.get('recipe_id') # Esperamos {"recipe_id": "mojito"}
    
    if not recipe_id:
        return jsonify({"status": "error", "mensaje": "Falta recipe_id"}), 400
        
    print(f"📥 Petición recibida: {recipe_id}")
    
    # Validamos y creamos el plan ANTES de encolar
    instructions, result_name = prepare_preparation_plan(recipe_id)
    
    if not instructions:
        # result_name contiene el mensaje de error en este caso
        return jsonify({"status": "error", "mensaje": result_name}), 400
    
    # Calculamos tiempo total estimado
    total_est = sum(step['duration'] for step in instructions) + len(instructions)
    
    # Encolamos el trabajo ya masticado
    job = {
        "recipe_name": result_name,
        "instructions": instructions,
        "timestamp": time.time()
    }
    pedidos_queue.put(job)
    
    return jsonify({
        "status": "success",
        "mensaje": f"Marchando un {result_name}",
        "tiempo_estimado": f"{total_est:.0f}s",
        "cola": pedidos_queue.qsize()
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
    """Endpoint útil para ver cómo está calculando los tiempos"""
    return jsonify(CALIBRACION_POR_PIN)

# ============================================
# MAIN
# ============================================
if __name__ == '__main__':
    try:
        print("\n--- INICIANDO BARTENDER IA ---")
        if setup_gpio():
            # Arrancar Worker
            t = threading.Thread(target=procesar_pedidos, daemon=True)
            t.start()
            
            # Arrancar Flask
            app.run(host='0.0.0.0', port=5000, debug=False)
        else:
            print("Error fatal en configuración GPIO")
            
    except KeyboardInterrupt:
        print("\nApagando...")
        GPIO.cleanup()
