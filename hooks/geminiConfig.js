// ============================================
// hooks/geminiConfig.js - Barman AI Configuration
// ============================================
const { GoogleGenAI } = require('@google/genai');

const API_CONFIG = {
  GEMINI: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    models: {
      'gemini-pro': 'gemini-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro'
    },
    defaultModel: 'gemini-1.5-flash',
    endpoints: {
      generateContent: (model) => `/models/${model}:generateContent`
    },
    defaultParams: {
      temperature: 0.7,
      topP: 0.8,
      maxOutputTokens: 200 // Limitar para respuestas cortas
    }
  }
};

const RATE_LIMITS = {
  GEMINI: {
    requestsPerMinute: 60,
    requestsPerDay: 1000
  }
};

// Configuración de bombas IoT (Raspberry Pi)
const PUMP_CONFIG = {
  pump_1: { 
    id: 1, 
    ingredient: 'ron', 
    gpio_pin: 17,
    ml_per_second: 10
  },
  pump_2: { 
    id: 2, 
    ingredient: 'vodka', 
    gpio_pin: 27,
    ml_per_second: 10
  },
  pump_3: { 
    id: 3, 
    ingredient: 'tequila', 
    gpio_pin: 22,
    ml_per_second: 10
  },
  pump_4: { 
    id: 4, 
    ingredient: 'jugo_lima', 
    gpio_pin: 23,
    ml_per_second: 10
  },
  pump_5: { 
    id: 5, 
    ingredient: 'triple_sec', 
    gpio_pin: 24,
    ml_per_second: 10
  },
  pump_6: { 
    id: 6, 
    ingredient: 'soda', 
    gpio_pin: 25,
    ml_per_second: 10
  }
};

// Recetas de cócteles disponibles
const COCKTAIL_RECIPES = {
  mojito: {
    name: 'Mojito',
    ingredients: [
      { pump: 'pump_1', ingredient: 'ron', ml: 50 },
      { pump: 'pump_4', ingredient: 'jugo_lima', ml: 30 },
      { pump: 'pump_6', ingredient: 'soda', ml: 100 }
    ],
    description: 'Ron blanco, lima, menta y soda'
  },
  margarita: {
    name: 'Margarita',
    ingredients: [
      { pump: 'pump_3', ingredient: 'tequila', ml: 50 },
      { pump: 'pump_5', ingredient: 'triple_sec', ml: 25 },
      { pump: 'pump_4', ingredient: 'jugo_lima', ml: 25 }
    ],
    description: 'Tequila, triple sec y lima'
  },
  vodka_soda: {
    name: 'Vodka Soda',
    ingredients: [
      { pump: 'pump_2', ingredient: 'vodka', ml: 50 },
      { pump: 'pump_4', ingredient: 'jugo_lima', ml: 15 },
      { pump: 'pump_6', ingredient: 'soda', ml: 120 }
    ],
    description: 'Vodka con soda y un toque de lima'
  }
};

const MODELS_CONFIG = {
  BARMAN: {
    name: 'Barman AI',
    description: 'Asistente especializado en preparación de cócteles con sistema IoT',
    capabilities: ['cocktail_recommendation', 'recipe_creation', 'ingredient_check', 'preparation_control'],
    prompts: {
      system: `Eres un barman profesional AI que ayuda a preparar cócteles usando un sistema IoT con bombas automáticas.

**INGREDIENTES DISPONIBLES:**
${Object.entries(PUMP_CONFIG).map(([key, pump]) => `- Bomba ${pump.id} (GPIO ${pump.gpio_pin}): ${pump.ingredient}`).join('\n')}

**CÓCTELES DISPONIBLES:**
${Object.entries(COCKTAIL_RECIPES).map(([key, recipe]) => `- ${recipe.name}: ${recipe.description}`).join('\n')}

**TUS REGLAS:**
1. Responde SIEMPRE en máximo 500 caracteres
2. Si el usuario pide un cóctel, describe los ingredientes brevemente
3. Si el cóctel no está disponible, sugiere alternativas con los ingredientes que tienes
4. Sé amable, profesional y conciso
5. Usa emojis sutiles (🍹, 🍸, 🍋) para dar personalidad
6. Si el usuario pregunta sobre ingredientes, menciona solo los disponibles en las bombas`,

      cocktail_request: `El usuario pidió: "{query}"

Analiza si:
1. Es un cóctel disponible en tu menú
2. Se puede preparar con los ingredientes actuales
3. Necesita sugerencias alternativas

Responde de forma amable y directa en máximo 500 caracteres.`,

      ingredient_query: `El usuario pregunta sobre ingredientes o qué puede hacer.

Ingredientes disponibles: ${Object.values(PUMP_CONFIG).map(p => p.ingredient).join(', ')}

Responde listando 2-3 cócteles posibles de forma breve y atractiva.`,
    }
  },
};

/**
 * Detecta si el usuario está pidiendo preparar un cóctel
 * @param {string} text - Mensaje del usuario
 * @returns {Object|null} - Información del cóctel o null
 */
function detectCocktailRequest(text) {
  const lowerText = text.toLowerCase();
  
  // Buscar coincidencias con recetas disponibles
  for (const [key, recipe] of Object.entries(COCKTAIL_RECIPES)) {
    if (lowerText.includes(recipe.name.toLowerCase()) || lowerText.includes(key)) {
      return { cocktailId: key, recipe };
    }
  }
  
  // Palabras clave que indican intención de pedir
  const keywords = ['quiero', 'dame', 'prepara', 'hazme', 'quisiera', 'me gustaría'];
  const hasCocktailIntent = keywords.some(keyword => lowerText.includes(keyword));
  
  return hasCocktailIntent ? { intent: 'request', cocktailId: null } : null;
}

/**
 * Genera el payload para enviar al Raspberry Pi
 * @param {Object} recipe - Receta del cóctel
 * @returns {Object} - Payload con instrucciones de bombas
 */
function generateRaspberryPayload(recipe) {
  const pumps = {};
  
  recipe.ingredients.forEach(ingredient => {
    const pumpConfig = PUMP_CONFIG[ingredient.pump];
    const durationMs = (ingredient.ml / pumpConfig.ml_per_second) * 1000;
    
    pumps[ingredient.pump] = {
      gpio_pin: pumpConfig.gpio_pin,
      ingredient: ingredient.ingredient,
      ml: ingredient.ml,
      duration_ms: Math.round(durationMs)
    };
  });
  
  return {
    recipe_id: recipe.name.toLowerCase().replace(/\s+/g, '_'),
    recipe_name: recipe.name,
    pumps,
    total_ml: recipe.ingredients.reduce((sum, ing) => sum + ing.ml, 0),
    timestamp: Date.now()
  };
}

/**
 * Envía un prompt a Gemini para el Barman AI
 * @param {string} text - El mensaje del usuario
 * @param {string} apiKey - La API Key de Gemini
 * @param {string} [model] - El modelo a usar
 * @returns {Promise<Object>} - Respuesta con texto y acción a realizar
 */
async function sendGeminiPrompt(
  text,
  apiKey,
  model = 'gemini-1.5-flash'
) {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Detectar si hay una solicitud de cóctel
    const cocktailRequest = detectCocktailRequest(text);
    
    // Construir contexto dinámico
    const systemPrompt = MODELS_CONFIG.BARMAN.prompts.system;
    const userPrompt = cocktailRequest?.intent 
      ? MODELS_CONFIG.BARMAN.prompts.cocktail_request.replace('{query}', text)
      : `Usuario dice: "${text}"\n\nResponde de forma amable y útil en máximo 500 caracteres.`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const result = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: fullPrompt }] }]
    });

    // Extraer texto de respuesta
    let responseText = '';
    if (result == null) throw new Error('Respuesta vacía de Gemini');
    if (typeof result.text === 'string' && result.text.length) responseText = result.text;
    else if (typeof result.outputText === 'string' && result.outputText.length) responseText = result.outputText;
    else if (result.candidates?.[0]) {
      const cand = result.candidates[0];
      if (cand.text) responseText = cand.text;
      else if (cand.content?.parts?.[0]?.text) responseText = cand.content.parts[0].text;
    }
    
    if (!responseText) throw new Error('No se recibió respuesta válida de Gemini');

    // Truncar a 500 caracteres
    responseText = responseText.substring(0, 500);

    // Preparar respuesta con acción
    const response = {
      text: responseText,
      shouldPrepare: false,
      recipe: null,
      raspberryPayload: null
    };

    // Si se detectó un cóctel específico, preparar payload
    if (cocktailRequest?.cocktailId) {
      const recipe = COCKTAIL_RECIPES[cocktailRequest.cocktailId];
      response.shouldPrepare = true;
      response.recipe = recipe;
      response.raspberryPayload = generateRaspberryPayload(recipe);
      
      // Loguear payload (simulación hasta que llegue Raspberry)
      console.log('🍹 RASPBERRY PI PAYLOAD:', JSON.stringify(response.raspberryPayload, null, 2));
    }

    return response;
  } catch (error) {
    throw new Error(error.message || 'Error al conectar con Gemini');
  }
}

/**
 * Obtiene la lista de cócteles disponibles
 * @returns {Array} - Lista de cócteles con sus recetas
 */
function getAvailableCocktails() {
  return Object.entries(COCKTAIL_RECIPES).map(([id, recipe]) => ({
    id,
    ...recipe
  }));
}

/**
 * Obtiene la configuración de bombas disponibles
 * @returns {Object} - Configuración de bombas
 */
function getPumpConfiguration() {
  return PUMP_CONFIG;
}

/**
 * Simula el envío al Raspberry Pi (hasta que esté disponible)
 * @param {Object} payload - Payload a enviar
 * @returns {Promise<Object>} - Respuesta simulada
 */
async function sendToRaspberryPi(payload) {
  console.log('\n🤖 SIMULACIÓN - ENVIANDO AL RASPBERRY PI:');
  console.log('━'.repeat(50));
  console.log(JSON.stringify(payload, null, 2));
  console.log('━'.repeat(50));
  console.log(`📊 Total ML: ${payload.total_ml}ml`);
  console.log(`⏱️  Tiempo estimado: ${Math.max(...Object.values(payload.pumps).map(p => p.duration_ms))}ms\n`);
  
  // Simular delay de preparación
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'success',
        message: `${payload.recipe_name} preparado exitosamente`,
        timestamp: Date.now()
      });
    }, 2000); // 2 segundos de simulación
  });
}

module.exports = {
  API_CONFIG,
  RATE_LIMITS,
  MODELS_CONFIG,
  PUMP_CONFIG,
  COCKTAIL_RECIPES,
  sendGeminiPrompt,
  detectCocktailRequest,
  generateRaspberryPayload,
  getAvailableCocktails,
  getPumpConfiguration,
  sendToRaspberryPi
};