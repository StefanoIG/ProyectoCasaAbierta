import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { COCKTAIL_RECIPES, PUMP_CONFIG, getIngredientPump, INGREDIENT_EMOTES } from '@/lib/cocktails';

// ============================================
// RATE LIMITING - Gemini API
// ============================================
let lastRequest = 0;
const COOLDOWN = 35000; // 35 segundos entre requests

// ============================================
// CONFIGURACIÓN RASPBERRY PI
// ============================================
const RASPBERRY_PI_CONFIG = {
  host: '192.168.1.23',
  port: 5000,
  endpoint: '/hacer_trago'
};

const getRaspberryUrl = () => 
  `http://${RASPBERRY_PI_CONFIG.host}:${RASPBERRY_PI_CONFIG.port}${RASPBERRY_PI_CONFIG.endpoint}`;

// Detectar idioma del mensaje con mayor precisión
function detectLanguage(text: string, previousLanguage: 'es' | 'en' = 'es'): 'es' | 'en' {
  const lowerText = text.toLowerCase();
  
  // Detectar tildes o ñ (definitivamente español)
  if (/[áéíóúñ¿¡]/i.test(text)) {
    return 'es';
  }
  
  // Palabras ÚNICAS en inglés (no existen en español)
  const uniqueEnglishWords = [
    'what', 'do', 'you', 'have', 'drinks', 'want', 'give', 
    'can', 'make', 'the', 'and', 'cocktails', 'available',
    'please', 'would', 'could', 'should'
  ];
  
  // Palabras ÚNICAS en español (no existen en inglés)
  const uniqueSpanishWords = [
    'qué', 'tienes', 'dame', 'quiero', 'hola', 'prepara',
    'quisiera', 'gustaría', 'cócteles', 'tragos', 'bebidas',
    'disponibles', 'favor', 'hazme', 'dime', 'un', 'una'
  ];
  
  let englishScore = 0;
  let spanishScore = 0;
  
  // Contar palabras únicas
  uniqueEnglishWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lowerText)) {
      englishScore += 2; // Peso mayor
    }
  });
  
  uniqueSpanishWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lowerText)) {
      spanishScore += 2; // Peso mayor
    }
  });
  
  // Si hay score definitivo, usar ese idioma
  if (englishScore > 0 && spanishScore === 0) return 'en';
  if (spanishScore > 0 && englishScore === 0) return 'es';
  
  // Si ambos tienen score, el mayor gana
  if (englishScore > spanishScore) return 'en';
  if (spanishScore > englishScore) return 'es';
  
  // Si empate o sin coincidencias, mantener idioma anterior
  return previousLanguage;
}

function detectCocktailRequest(text: string, language: 'es' | 'en' = 'es') {
  const lowerText = text.toLowerCase();
  
  // Detectar confirmación de botón (NUEVO SISTEMA)
  const buttonConfirmPattern = /^CONFIRM_ORDER_(.+)$/i;
  const buttonMatch = text.match(buttonConfirmPattern);
  
  if (buttonMatch) {
    const cocktailId = buttonMatch[1].toLowerCase();
    const recipe = COCKTAIL_RECIPES[cocktailId as keyof typeof COCKTAIL_RECIPES];
    if (recipe) {
      return { cocktailId, recipe, confirmed: true, isButtonConfirm: true };
    }
  }
  
  // Búsqueda normal de cócteles - MEJORADA
  // Primero buscar coincidencia exacta del nombre completo
  for (const [key, recipe] of Object.entries(COCKTAIL_RECIPES)) {
    const recipeName = (recipe as any).name.toLowerCase();
    if (lowerText.includes(recipeName)) {
      return { cocktailId: key, recipe, confirmed: false, isButtonConfirm: false };
    }
  }
  
  // Luego buscar por palabras clave del coctel
  if (lowerText.includes('mojito')) {
    return { cocktailId: 'mojito', recipe: COCKTAIL_RECIPES.mojito, confirmed: false, isButtonConfirm: false };
  }
  if (lowerText.includes('margarita')) {
    return { cocktailId: 'margarita', recipe: COCKTAIL_RECIPES.margarita, confirmed: false, isButtonConfirm: false };
  }
  if (lowerText.includes('cuba') && lowerText.includes('libre')) {
    return { cocktailId: 'cuba_libre', recipe: COCKTAIL_RECIPES.cuba_libre, confirmed: false, isButtonConfirm: false };
  }
  if (lowerText.includes('paloma')) {
    return { cocktailId: 'paloma', recipe: COCKTAIL_RECIPES.paloma, confirmed: false, isButtonConfirm: false };
  }
  if ((lowerText.includes('vodka') && lowerText.includes('citrus')) || (lowerText.includes('vodka') && lowerText.includes('cítrus'))) {
    return { cocktailId: 'vodka_citrus', recipe: COCKTAIL_RECIPES.vodka_citrus, confirmed: false, isButtonConfirm: false };
  }
  if ((lowerText.includes('vodka') && lowerText.includes('soda')) || (lowerText.match(/\bvodka\b/) && !lowerText.includes('citrus'))) {
    return { cocktailId: 'vodka_soda', recipe: COCKTAIL_RECIPES.vodka_soda, confirmed: false, isButtonConfirm: false };
  }
  if (lowerText.includes('tequila') && (lowerText.includes('sunrise') || lowerText.includes('amanecer'))) {
    return { cocktailId: 'tequila_sunrise', recipe: COCKTAIL_RECIPES.tequila_sunrise, confirmed: false, isButtonConfirm: false };
  }
  if (lowerText.includes('ron') && lowerText.includes('collins')) {
    return { cocktailId: 'ron_collins', recipe: COCKTAIL_RECIPES.ron_collins, confirmed: false, isButtonConfirm: false };
  }
  
  // Detectar intención de pedir un cóctel
  const intentKeywords = language === 'es' 
    ? ['quiero', 'dame', 'prepara', 'hazme', 'quisiera', 'me gustaría', 'un ']
    : ['want', 'make', 'prepare', 'would like', 'give me', 'can you make', 'get me'];
    
  const hasCocktailIntent = intentKeywords.some(keyword => lowerText.includes(keyword));
  
  return hasCocktailIntent ? { intent: 'request', cocktailId: null, confirmed: false, isButtonConfirm: false } : null;
}

function generateRaspberryPayload(recipe: any) {
  const pumps: any = {};
  let totalMl = 0;
  
  // Convertir ingredientes del nuevo formato
  for (const [ingredientName, ml] of Object.entries(recipe.ingredients)) {
    const pumpKey = getIngredientPump(ingredientName);
    if (!pumpKey) continue;
    
    const pumpConfig = PUMP_CONFIG[pumpKey as keyof typeof PUMP_CONFIG];
    const mlValue = ml as number;
    const durationMs = (mlValue / pumpConfig.ml_per_second) * 1000;
    
    pumps[pumpKey] = {
      gpio_pin: pumpConfig.gpio_pin,
      ingredient: ingredientName,
      ml: mlValue,
      duration_ms: Math.round(durationMs)
    };
    
    totalMl += mlValue;
  }
  
  return {
    recipe_id: recipe.name.toLowerCase().replace(/\s+/g, '_'),
    recipe_name: recipe.name,
    pumps,
    total_ml: totalMl,
    timestamp: Date.now()
  };
}

async function sendToRaspberryPi(payload: any) {
  try {
    const url = getRaspberryUrl();
    console.log(`🍹 Enviando payload a Raspberry Pi: ${url}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Respuesta de Raspberry Pi:', result);
    return result;
  } catch (error: any) {
    console.error('❌ Error al enviar a Raspberry Pi:', error.message);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  let previousLanguage: 'es' | 'en' = 'es'; // Declarar fuera del try para usar en catch
  
  try {
    const requestData = await request.json();
    const { message, conversationHistory = [] } = requestData;
    previousLanguage = requestData.previousLanguage || 'es';
    
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key no configurada' },
        { status: 500 }
      );
    }

    // ============================================
    // RATE LIMITING CHECK
    // ============================================
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest < COOLDOWN) {
      const waitTime = Math.ceil((COOLDOWN - timeSinceLastRequest) / 1000);
      const errorMessage = previousLanguage === 'es' 
        ? `⏳ Por favor espera ${waitTime} segundos antes de enviar otro mensaje`
        : `⏳ Please wait ${waitTime} seconds before sending another message`;
      
      console.log(`⚠️ Rate limit: Usuario debe esperar ${waitTime}s`);
      
      return NextResponse.json(
        { 
          error: errorMessage,
          isRateLimit: true,
          waitTime: waitTime
        },
        { status: 429 }
      );
    }
    
    // Actualizar último request
    lastRequest = now;

    // Detectar idioma del mensaje (pasar idioma anterior)
    const language = detectLanguage(message, previousLanguage);

    // Inicializar Google Generative AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    // Detectar si hay solicitud de cóctel
    const cocktailRequest = detectCocktailRequest(message, language);

    // Sistema prompt mejorado bilingüe
    const isFirstMessage = conversationHistory.length === 0;

    const systemPrompt = language === 'es' ? `Eres un barman profesional AI amable y cordial que ayuda a preparar cócteles usando un sistema IoT con bombas automáticas.

**INGREDIENTES DISPONIBLES:**
${Object.entries(PUMP_CONFIG)
  .map(([key, pump]) => `- ${pump.ingredient.replace('_', ' ')}`)
  .join('\n')}

**CÓCTELES DISPONIBLES:**
${Object.entries(COCKTAIL_RECIPES)
  .map(([key, recipe]) => {
    const ingredients = Object.keys((recipe as any).ingredients)
      .map((ing: string) => ing.replace('_', ' '))
      .join(', ');
    return `- **${(recipe as any).name}**: ${ingredients}`;
  })
  .join('\n')}

**INSTRUCCIONES CRÍTICAS:**
1. SIEMPRE responde ÚNICAMENTE en ESPAÑOL
2. Máximo 180 caracteres - sé muy breve
3. ${isFirstMessage ? 'Primera vez: "¡Hola! 🍹 ¿Qué coctel?"' : 'NO saludes'}
4. Solo 1 emoji 🍹
5. Nombres simples de ingredientes

**REGLAS ABSOLUTAS - PROHIBIDO:**
❌ NUNCA digas "para confirmar"
❌ NUNCA digas "escribe"
❌ NUNCA digas "CONFIRMAR PEDIDO"
❌ NUNCA pidas que escriban algo
✅ Solo menciona el coctel e ingredientes

**FORMATO OBLIGATORIO cuando piden coctel:**
"🍹 [Nombre]: [ingredientes con ml]"

**EJEMPLOS:**
Usuario: "Quiero mojito"
Tú: "🍹 Mojito: 50ml ron, 30ml lima, 100ml soda"

Usuario: "dame vodka"
Tú: "🍹 Vodka Soda: 50ml vodka, 100ml soda, 20ml lima"

Usuario: "Hola"
Tú: "¡Hola! 🍹 ¿Qué coctel te preparo?"` : 
`You are a friendly professional AI bartender that helps prepare cocktails using an IoT system with automatic pumps.

**AVAILABLE INGREDIENTS:**
${Object.entries(PUMP_CONFIG)
  .map(([key, pump]) => `- ${pump.ingredient.replace('_', ' ')}`)
  .join('\n')}

**AVAILABLE COCKTAILS:**
${Object.entries(COCKTAIL_RECIPES)
  .map(([key, recipe]) => {
    const ingredients = Object.keys((recipe as any).ingredients)
      .map((ing: string) => ing.replace('_', ' '))
      .join(', ');
    return `- **${(recipe as any).name}**: ${ingredients}`;
  })
  .join('\n')}

**CRITICAL INSTRUCTIONS:**
1. ALWAYS respond ONLY in ENGLISH
2. Maximum 180 characters - be very brief
3. ${isFirstMessage ? 'First time: "Hello! 🍹 What cocktail?"' : 'NO greetings'}
4. Only 1 emoji 🍹
5. Simple ingredient names

**ABSOLUTE RULES - FORBIDDEN:**
❌ NEVER say "to confirm"
❌ NEVER say "write"
❌ NEVER say "CONFIRM ORDER"
❌ NEVER ask them to write anything
✅ Only mention cocktail and ingredients

**MANDATORY FORMAT when requesting cocktail:**
"🍹 [Name]: [ingredients with ml]"

**EXAMPLES:**
User: "I want mojito"
You: "🍹 Mojito: 50ml rum, 30ml lime, 100ml soda"

User: "give me vodka"
You: "🍹 Vodka Soda: 50ml vodka, 100ml soda, 20ml lime"`;

    // LOG para debugging
    console.log('🔍 Idioma detectado:', language, '| Mensaje:', message);

    // Construir historial de conversación
    const contents = [
      ...conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    // Llamar a Gemini con historial
    const result = await model.generateContent({
      contents,
      systemInstruction: systemPrompt
    });

    const response = await result.response;
    const responseText = response.text();
    
    // LOG de respuesta
    console.log('💬 Respuesta IA:', responseText);

    // Preparar respuesta
    const finalResponse: any = {
      text: responseText,
      shouldPrepare: false,
      showConfirmButton: false,
      cocktailId: null,
      recipe: null,
      raspberryPayload: null,
      raspberryResponse: null,
      language
    };

    // Si se detectó un cóctel
    if (cocktailRequest?.cocktailId) {
      const recipe = COCKTAIL_RECIPES[cocktailRequest.cocktailId as keyof typeof COCKTAIL_RECIPES];
      
      console.log('🍸 Cóctel detectado:', cocktailRequest.cocktailId, '| Confirmado:', cocktailRequest.confirmed);
      
      // Si es confirmación por botón, preparar
      if (cocktailRequest.confirmed && cocktailRequest.isButtonConfirm) {
        finalResponse.shouldPrepare = true;
        finalResponse.recipe = recipe;
        finalResponse.raspberryPayload = generateRaspberryPayload(recipe);
        
        console.log('🍹 RASPBERRY PI PAYLOAD:', JSON.stringify(finalResponse.raspberryPayload, null, 2));
        
        // Enviar al Raspberry Pi
        try {
          const raspberryResult = await sendToRaspberryPi(finalResponse.raspberryPayload);
          finalResponse.raspberryResponse = raspberryResult;
          console.log('✅ Cóctel enviado a preparar exitosamente');
        } catch (error: any) {
          console.error('❌ Error al enviar al Raspberry Pi:', error.message);
          finalResponse.raspberryResponse = { 
            error: true, 
            message: `Error al comunicarse con el Raspberry Pi: ${error.message}` 
          };
        }
      } else if (!cocktailRequest.confirmed) {
        // Mostrar botón de confirmación
        finalResponse.showConfirmButton = true;
        finalResponse.cocktailId = cocktailRequest.cocktailId;
        finalResponse.recipe = recipe;
        console.log('✨ Mostrando botón de confirmación para:', cocktailRequest.cocktailId);
      }
    }

    return NextResponse.json(finalResponse);
  } catch (error: any) {
    console.error('Error en chat API:', error);
    
    // Manejar específicamente errores de quota de Gemini
    if (error.message && error.message.includes('quota') || error.status === 429) {
      const errorMessage = previousLanguage === 'es'
        ? '⚠️ Se alcanzó el límite de la API. Por favor espera 35 segundos e intenta de nuevo.'
        : '⚠️ API rate limit reached. Please wait 35 seconds and try again.';
      
      return NextResponse.json(
        { 
          error: errorMessage,
          isRateLimit: true,
          waitTime: 35
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Error procesando el mensaje' },
      { status: 500 }
    );
  }
}
