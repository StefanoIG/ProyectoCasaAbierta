import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configuración de cócteles
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

const PUMP_CONFIG = {
  pump_1: { id: 1, ingredient: 'ron', gpio_pin: 17, ml_per_second: 10 },
  pump_2: { id: 2, ingredient: 'vodka', gpio_pin: 27, ml_per_second: 10 },
  pump_3: { id: 3, ingredient: 'tequila', gpio_pin: 22, ml_per_second: 10 },
  pump_4: { id: 4, ingredient: 'jugo_lima', gpio_pin: 23, ml_per_second: 10 },
  pump_5: { id: 5, ingredient: 'triple_sec', gpio_pin: 24, ml_per_second: 10 },
  pump_6: { id: 6, ingredient: 'soda', gpio_pin: 25, ml_per_second: 10 }
};

function detectCocktailRequest(text: string) {
  const lowerText = text.toLowerCase();
  
  for (const [key, recipe] of Object.entries(COCKTAIL_RECIPES)) {
    if (lowerText.includes((recipe as any).name.toLowerCase()) || lowerText.includes(key)) {
      return { cocktailId: key, recipe };
    }
  }
  
  const keywords = ['quiero', 'dame', 'prepara', 'hazme', 'quisiera', 'me gustaría'];
  const hasCocktailIntent = keywords.some(keyword => lowerText.includes(keyword));
  
  return hasCocktailIntent ? { intent: 'request', cocktailId: null } : null;
}

function generateRaspberryPayload(recipe: any) {
  const pumps: any = {};
  
  recipe.ingredients.forEach((ingredient: any) => {
    const pumpConfig = PUMP_CONFIG[ingredient.pump as keyof typeof PUMP_CONFIG];
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
    total_ml: recipe.ingredients.reduce((sum: number, ing: any) => sum + ing.ml, 0),
    timestamp: Date.now()
  };
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Detectar si hay solicitud de cóctel
    const cocktailRequest = detectCocktailRequest(message);

    // Sistema prompt mejorado con emotes y mejor formateo
    const isFirstMessage = conversationHistory.length === 0;
    
    // Crear mapeo de ingredientes a emotes
    const ingredientEmotes: { [key: string]: string } = {
      'ron': '🥃',
      'vodka': '🧊',
      'tequila': '🌵',
      'jugo_lima': '🍋',
      'triple_sec': '🍊',
      'soda': '💧',
    };

    const systemPrompt = `Eres un barman profesional AI amable y cordial que ayuda a preparar cócteles usando un sistema IoT con bombas automáticas.

**INGREDIENTES DISPONIBLES:**
${Object.entries(PUMP_CONFIG)
  .map(([key, pump]) => `${ingredientEmotes[pump.ingredient] || '🥤'} ${pump.ingredient.replace('_', ' ')}`)
  .join('\n')}

**CÓCTELES DISPONIBLES:**
${Object.entries(COCKTAIL_RECIPES)
  .map(([key, recipe]) => {
    const ingredients = (recipe as any).ingredients
      .map((ing: any) => `${ingredientEmotes[ing.ingredient] || '🥤'} ${ing.ingredient.replace('_', ' ')}`)
      .join(', ');
    return `🍹 **${(recipe as any).name}** → ${ingredients}`;
  })
  .join('\n')}

**INSTRUCCIONES CRÍTICAS:**
1. Responde SIEMPRE en máximo 500 caracteres
2. ${isFirstMessage ? 'Saluda calurosamente con emote al usuario la PRIMERA VEZ' : 'NO saludes - continúa la conversación naturalmente sin saludos'}
3. Usa emotes para cada ingrediente cuando los menciones (ej: 🥃 para ron, 🍋 para lima, 🍊 para triple sec, etc)
4. Usa emotes para cada bebida cuando las menciones (ej: 🍹 para cócteles)
5. Mantén un tono profesional, formal pero MUY CORDIAL y amable
6. Cuando listes ingredientes, usa el emote + nombre legible (ej: "🥃 ron" NO "jugo_lima")
7. Sé conciso pero cálido - usa emotes de forma natural en la conversación
8. Si el usuario pide un cóctel, describe los ingredientes con sus emotes y prepáralo
9. Si el cóctel no está disponible, sugiere alternativas mostrando sus ingredientes con emotes
10. IMPORTANTE: Reemplaza siempre nombres con guiones bajo (jugo_lima, triple_sec, etc) por nombres legibles con emotes (🍋 lima, 🍊 triple sec)`;

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
      raspberryPayload: null
    };

    // Si se detectó un cóctel, preparar payload
    if (cocktailRequest?.cocktailId) {
      const recipe = COCKTAIL_RECIPES[cocktailRequest.cocktailId as keyof typeof COCKTAIL_RECIPES];
      finalResponse.shouldPrepare = true;
      finalResponse.recipe = recipe;
      finalResponse.raspberryPayload = generateRaspberryPayload(recipe);
      console.log('🍹 RASPBERRY PI PAYLOAD:', JSON.stringify(finalResponse.raspberryPayload, null, 2));
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
