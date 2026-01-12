import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { COCKTAIL_RECIPES, PUMP_CONFIG, getIngredientPump, INGREDIENT_EMOTES } from '@/lib/cocktails';

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

function detectCocktailRequest(text: string) {
  const lowerText = text.toLowerCase();
  
  // Detectar confirmación explícita
  const confirmPattern = /confirmar\s+(?:pedido\s+(?:de\s+)?)?(\w+)/i;
  const confirmMatch = text.match(confirmPattern);
  
  if (confirmMatch) {
    const cocktailName = confirmMatch[1].toLowerCase();
    for (const [key, recipe] of Object.entries(COCKTAIL_RECIPES)) {
      if ((recipe as any).name.toLowerCase().includes(cocktailName) || key.includes(cocktailName)) {
        return { cocktailId: key, recipe, confirmed: true };
      }
    }
  }
  
  // Búsqueda normal de cócteles (sin confirmación)
  for (const [key, recipe] of Object.entries(COCKTAIL_RECIPES)) {
    if (lowerText.includes((recipe as any).name.toLowerCase()) || lowerText.includes(key)) {
      return { cocktailId: key, recipe, confirmed: false };
    }
  }
  
  const keywords = ['quiero', 'dame', 'prepara', 'hazme', 'quisiera', 'me gustaría'];
  const hasCocktailIntent = keywords.some(keyword => lowerText.includes(keyword));
  
  return hasCocktailIntent ? { intent: 'request', cocktailId: null, confirmed: false } : null;
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
  try {
    const { message, conversationHistory = [] } = await request.json();
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key no configurada' },
        { status: 500 }
      );
    }

    // Inicializar Google Generative AI
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    // Detectar si hay solicitud de cóctel
    const cocktailRequest = detectCocktailRequest(message);

    // Sistema prompt mejorado con emotes y mejor formateo
    const isFirstMessage = conversationHistory.length === 0;

    const systemPrompt = `Eres un barman profesional AI amable y cordial que ayuda a preparar cócteles usando un sistema IoT con bombas automáticas.

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
1. Responde en máximo 300 caracteres de forma concisa y directa
2. ${isFirstMessage ? 'Saluda brevemente al usuario la PRIMERA VEZ (ejemplo: "¡Hola! Bienvenido al barman automático 🍹")' : 'NO saludes - continúa la conversación naturalmente'}
3. Usa SOLO 1 emoji por mensaje (preferiblemente 🍹 al mencionar cócteles)
4. Mantén un tono profesional y cordial pero CONCISO
5. Cuando menciones ingredientes, usa nombres legibles sin emojis (ejemplo: "ron, lima, soda" NO "🥃 ron, 🍋 lima, 💧 soda")
6. Sé breve y directo en tus respuestas

**REGLAS DE CONFIRMACIÓN OBLIGATORIAS:**
7. Si el usuario pide un cóctel que EXISTE, responde con los ingredientes y cantidades, luego EXIGE confirmación explícita
8. Para confirmar, el usuario DEBE escribir exactamente: "CONFIRMAR PEDIDO DE [NOMBRE_COCKTAIL]"
9. NO prepares NINGÚN cóctel hasta que el usuario escriba la confirmación exacta
10. Si el usuario pide un cóctel que NO existe (ej: "Mojito 2"), responde que NO existe y menciona el nombre correcto disponible

**EJEMPLOS DE RESPUESTAS CONCISAS:**
Usuario: "Quiero un mojito"
Tú: "🍹 Mojito: 50ml ron, 30ml lima, 100ml soda. Para confirmar escribe: CONFIRMAR PEDIDO DE MOJITO"

Usuario: "Quiero un mojito 2"
Tú: "No tenemos 'Mojito 2'. Solo disponemos de Mojito. Para pedirlo escribe: CONFIRMAR PEDIDO DE MOJITO"

Usuario: "Hola"
Tú: "¡Hola! Bienvenido al barman automático 🍹 Tenemos 8 cócteles disponibles. ¿Cuál te gustaría?"`;

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

    // Preparar respuesta
    const finalResponse: any = {
      text: responseText,
      shouldPrepare: false,
      recipe: null,
      raspberryPayload: null,
      raspberryResponse: null
    };

    // Si se detectó un cóctel Y está confirmado, preparar y enviar
    if (cocktailRequest?.cocktailId && cocktailRequest.confirmed) {
      const recipe = COCKTAIL_RECIPES[cocktailRequest.cocktailId as keyof typeof COCKTAIL_RECIPES];
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
    }

    return NextResponse.json(finalResponse);
  } catch (error: any) {
    console.error('Error en chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando el mensaje' },
      { status: 500 }
    );
  }
}
