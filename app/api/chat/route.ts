import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { COCKTAIL_RECIPES, PUMP_CONFIG, getAvailableCocktails, getAvailableIngredients } from '@/lib/cocktails';

// ============================================
// CONFIGURACIÓN DESDE ENV
// ============================================
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY;
const RASPBERRY_PI_HOST = process.env.NEXT_PUBLIC_RASPBERRY_PI_HOST || '192.168.1.23';
const RASPBERRY_PI_PORT = process.env.NEXT_PUBLIC_RASPBERRY_PI_PORT || '5000';

// ============================================
// RESPUESTAS DE RESPALDO (FALLBACK)
// ============================================
function getFallbackResponses() {
  const fallbackStr = process.env.NEXT_PUBLIC_FALLBACK_RESPONSES || '';
  const responses: { [key: string]: string } = {};
  
  fallbackStr.split('|').forEach(pair => {
    const [key, value] = pair.split(':');
    if (key && value) {
      responses[key.trim()] = value.trim();
    }
  });
  
  return responses;
}

// ============================================
// CONFIGURACIÓN RASPBERRY PI
// ============================================
const getRaspberryUrl = () => 
  `http://${RASPBERRY_PI_HOST}:${RASPBERRY_PI_PORT}/hacer_trago`;

// ============================================
// FUNCIONES DE IA - GEMINI Y GROQ
// ============================================
// ============================================
// FUNCIONES DE IA - GEMINI Y GROQ
// ============================================

// Detectar idioma del mensaje
function detectLanguage(text: string, previousLanguage: 'es' | 'en' = 'es'): 'es' | 'en' {
  const lowerText = text.toLowerCase();
  
  // Detectar tildes o ñ (definitivamente español)
  if (/[áéíóúñ¿¡]/i.test(text)) {
    return 'es';
  }
  
  // Palabras EXCLUSIVAS del español (no existen en inglés)
  const spanishOnlyWords = [
    'qué', 'cómo', 'cuándo', 'dónde', 'cuál', 'cuáles',
    'dame', 'hazme', 'prepara', 'preparame', 'quiero', 'quisiera', 'querría',
    'tienes', 'tenés', 'tiene', 'están', 'estás', 'está',
    'hola', 'buenos', 'buenas', 'días', 'tardes', 'noches',
    'recomiendas', 'recomendás', 'puedes', 'podés', 'puede',
    'cócteles', 'cóctel', 'tragos', 'trago', 'bebidas', 'bebida',
    'por', 'favor', 'gracias', 'muchas',
    'sí', 'claro', 'vale', 'okey',
    'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las',
    'del', 'al', 'con', 'sin', 'para', 'hacia'
  ];
  
  // Palabras EXCLUSIVAS del inglés (no existen en español)
  const englishOnlyWords = [
    'hi', 'hello', 'hey', 'good', 'morning', 'afternoon', 'evening',
    'what', 'where', 'when', 'which', 'who', 'whom', 'whose',
    'do', 'does', 'did', 'have', 'has', 'had',
    'can', 'could', 'would', 'should', 'will', 'shall',
    'give', 'make', 'prepare', 'recommend', 'suggest',
    'the', 'a', 'an', 'this', 'that', 'these', 'those',
    'please', 'thank', 'thanks', 'yes', 'yeah', 'yep', 'nope',
    'your', 'yours', 'my', 'mine', 'our', 'ours',
    'cocktail', 'cocktails', 'drink', 'drinks', 'beverage'
  ];
  
  let englishScore = 0;
  let spanishScore = 0;
  
  // Contar palabras exclusivas del español
  spanishOnlyWords.forEach(word => {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lowerText)) {
      spanishScore += 3; // Peso mayor para palabras exclusivas
    }
  });
  
  // Contar palabras exclusivas del inglés
  englishOnlyWords.forEach(word => {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lowerText)) {
      englishScore += 3; // Peso mayor para palabras exclusivas
    }
  });
  
  console.log(`🔍 Scores: Español=${spanishScore}, Inglés=${englishScore}`);
  
  // Si hay diferencia clara, usar ese idioma
  if (englishScore > spanishScore) return 'en';
  if (spanishScore > englishScore) return 'es';
  
  // Si empate, usar idioma anterior
  return previousLanguage;
}

// Detectar solicitud de cóctel
function detectCocktailRequest(text: string, language: 'es' | 'en' = 'es') {
  const lowerText = text.toLowerCase();
  
  // Detectar confirmación de botón
  const buttonConfirmPattern = /^CONFIRM_ORDER_(.+)$/i;
  const buttonMatch = text.match(buttonConfirmPattern);
  
  if (buttonMatch) {
    const cocktailId = buttonMatch[1];
    const recipe = COCKTAIL_RECIPES[cocktailId];
    if (recipe) {
      return { cocktailId, recipe, confirmed: true, isButtonConfirm: true };
    }
  }
  
  // Función auxiliar para comparación flexible (ignora tildes y errores menores)
  function normalizeText(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/\s+/g, '') // Quitar espacios
      .trim();
  }
  
  // Función para calcular similitud básica
  function isSimilar(str1: string, str2: string): boolean {
    const norm1 = normalizeText(str1);
    const norm2 = normalizeText(str2);
    
    // Coincidencia exacta sin tildes
    if (norm1 === norm2) return true;
    
    // Coincidencia si uno contiene al otro (para variaciones)
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
    
    // Similitud de Levenshtein simple (para errores de tipeo)
    const maxLength = Math.max(norm1.length, norm2.length);
    if (maxLength === 0) return true;
    
    let differences = 0;
    const minLength = Math.min(norm1.length, norm2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (norm1[i] !== norm2[i]) differences++;
    }
    differences += maxLength - minLength;
    
    // Permitir hasta 2 caracteres de diferencia
    return differences <= 2;
  }
  
  // Buscar por nombre de cóctel con comparación flexible
  for (const [id, recipe] of Object.entries(COCKTAIL_RECIPES)) {
    const recipeName = recipe.name;
    
    // Búsqueda exacta primero
    if (lowerText.includes(recipeName.toLowerCase())) {
      console.log(`🎯 Cóctel encontrado (exacto): ${recipeName}`);
      return { cocktailId: id, recipe, confirmed: false, isButtonConfirm: false };
    }
    
    // Búsqueda flexible por palabras del nombre
    const recipeWords = recipeName.toLowerCase().split(/\s+/);
    for (const word of recipeWords) {
      if (word.length < 4) continue; // Ignorar palabras muy cortas
      
      const textWords = lowerText.split(/\s+/);
      for (const textWord of textWords) {
        if (isSimilar(word, textWord)) {
          console.log(`🎯 Cóctel encontrado (similar): ${recipeName} (${word} ≈ ${textWord})`);
          return { cocktailId: id, recipe, confirmed: false, isButtonConfirm: false };
        }
      }
    }
  }
  
  // Detectar intención de pedir un cóctel (si no se encontró nombre específico)
  const intentKeywords = language === 'es' 
    ? ['quiero', 'dame', 'prepara', 'hazme', 'quisiera', 'me gustaría', 'pedido', 'pedir']
    : ['want', 'make', 'prepare', 'would like', 'give me', 'can you make', 'get me', 'order'];
    
  const hasCocktailIntent = intentKeywords.some(keyword => lowerText.includes(keyword));
  
  if (hasCocktailIntent) {
    console.log('🔍 Intención de cóctel detectada pero no se encontró nombre específico');
  }
  
  return null;
}

// Generar prompt del sistema
function generateSystemPrompt(language: 'es' | 'en', isFirstMessage: boolean) {
  const cocktails = getAvailableCocktails();
  const ingredients = getAvailableIngredients();
  
  const cocktailList = cocktails
    .map(c => {
      const ingredientsList = c.ingredients
        .map(ing => {
          const pumpConfig = PUMP_CONFIG[ing.pump as keyof typeof PUMP_CONFIG];
          return `${ing.ml}ml de ${pumpConfig.label}`;
        })
        .join(', ');
      return `- **${c.name}**: ${ingredientsList}`;
    })
    .join('\n');
  
  const ingredientList = ingredients
    .map(ing => `- ${ing.label}`)
    .join('\n');

  if (language === 'es') {
    return `Eres un barman profesional AI amable y cordial que ayuda a preparar cócteles usando un sistema IoT con bombas automáticas.

**INGREDIENTES DISPONIBLES:**
${ingredientList}

**CÓCTELES DISPONIBLES:**
${cocktailList}

**INSTRUCCIONES CRÍTICAS:**
1. SIEMPRE responde ÚNICAMENTE en ESPAÑOL
2. Sé amigable, detallado y descriptivo en tus respuestas
3. ${isFirstMessage ? 'Primera vez: saluda y menciona que puedes preparar cócteles' : 'Continúa la conversación naturalmente'}
4. Cuando menciones un cóctel, describe sus ingredientes y sabor
5. Si piden un cóctel, explica lo que lleva y pregunta si desean confirmarlo
6. Responde preguntas sobre ingredientes, cócteles y preparación
7. Sé conversacional - NO hay límites de tiempo ni prisa

**EJEMPLOS:**
Usuario: "Hola"
Tú: "¡Hola! 🍹 Soy tu barman personal. Puedo prepararte deliciosos cócteles como Margarita, Daiquiri, Gimlet y más. ¿Qué te gustaría tomar hoy?"

Usuario: "Quiero una Margarita"
Tú: "¡Excelente elección! 🍹 La Margarita es un clásico mexicano refrescante. Lleva 60ml de Tequila y 90ml de Mix Limón (Sweet & Sour). ¿Te la preparo?"

Usuario: "¿Qué ingredientes tienes?"
Tú: "Cuento con una variedad de ingredientes: Ron, Mix Limón (Sweet & Sour), Gin, Jugo de Naranja, Vodka y Tequila. ¿Te gustaría saber qué cócteles puedo hacer con estos?"`;
  } else {
    return `You are a friendly professional AI bartender that helps prepare cocktails using an IoT system with automatic pumps.

**AVAILABLE INGREDIENTS:**
${ingredientList}

**AVAILABLE COCKTAILS:**
${cocktailList}

**CRITICAL INSTRUCTIONS:**
1. ALWAYS respond ONLY in ENGLISH - NEVER in Spanish
2. Be friendly, detailed and descriptive in your responses
3. ${isFirstMessage ? 'First time: greet and mention you can prepare cocktails' : 'Continue the conversation naturally'}
4. When mentioning a cocktail, describe its ingredients and flavor
5. If they ask for a cocktail, explain what it contains and ask if they want to confirm
6. Answer questions about ingredients, cocktails and preparation
7. Be conversational - NO time limits or rush

**MANDATORY RULES:**
❌ NEVER respond in Spanish
❌ NEVER mix English and Spanish
✅ ONLY use English language

**EXAMPLES:**
User: "Hello"
You: "Hello! 🍹 I'm your personal bartender. I can prepare delicious cocktails like Margarita, Daiquiri, Gimlet and more. What would you like to drink today?"

User: "I want a Margarita"
You: "Excellent choice! 🍹 The Margarita is a refreshing Mexican classic. It has 60ml of Tequila and 90ml of Sweet & Sour Mix. Shall I prepare it for you?"

User: "What ingredients do you have?"
You: "I have a variety of ingredients: Rum, Sweet & Sour Mix, Gin, Orange Juice, Vodka and Tequila. Would you like to know what cocktails I can make with these?"`;
  }
}

// Intentar con Gemini
async function tryGemini(message: string, conversationHistory: any[], language: 'es' | 'en', isFirstMessage: boolean): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.log('❌ Gemini API Key no configurada');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const systemPrompt = generateSystemPrompt(language, isFirstMessage);
    
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
    
    const result = await model.generateContent({
      contents,
      systemInstruction: systemPrompt
    });
    
    const response = await result.response;
    const responseText = response.text();
    
    console.log('✅ Gemini respondió:', responseText.substring(0, 100));
    return responseText;
  } catch (error: any) {
    console.log('❌ Gemini falló:', error.message);
    return null;
  }
}

// Intentar con Groq
async function tryGroq(message: string, conversationHistory: any[], language: 'es' | 'en', isFirstMessage: boolean): Promise<string | null> {
  if (!GROQ_API_KEY) {
    console.log('❌ Groq API Key no configurada');
    return null;
  }

  try {
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    
    const systemPrompt = generateSystemPrompt(language, isFirstMessage);
    
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user' as const, content: message }
    ];
    
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 500
    });
    
    const responseText = chatCompletion.choices[0]?.message?.content || null;
    
    if (responseText) {
      console.log('✅ Groq respondió:', responseText.substring(0, 100));
    }
    
    return responseText;
  } catch (error: any) {
    console.log('❌ Groq falló:', error.message);
    return null;
  }
}

// Respuesta de respaldo (fallback)
function getFallbackResponse(message: string, language: 'es' | 'en'): string {
  const responses = getFallbackResponses();
  const lowerMessage = message.toLowerCase();
  
  // Detectar tipo de pregunta
  if (/hola|hi|hello|hey/i.test(lowerMessage)) {
    return responses['saludo'] || '¡Hola! 🍹 ¿Qué coctel te gustaría?';
  }
  
  if (/menú|menu|qué.*tienes|what.*have|opciones|options/i.test(lowerMessage)) {
    return responses['menu'] || 'Tengo Margarita, Daiquiri, Gimlet, Destornillador, Vodka Sour y Rum Punch.';
  }
  
  if (/ingredientes|ingredients/i.test(lowerMessage)) {
    return responses['ingredientes'] || 'Cuento con: Ron, Mix Limón, Gin, Jugo de Naranja, Vodka y Tequila';
  }
  
  return responses['default'] || '¿Qué coctel te gustaría probar hoy? 🍹';
}

// ============================================
// ENVÍO A RASPBERRY PI
// ============================================

// ============================================
// ENVÍO A RASPBERRY PI
// ============================================

async function sendToRaspberryPi(recipeId: number) {
  try {
    const url = getRaspberryUrl();
    
    const payload = {
      recipe_id: recipeId
    };
    
    console.log('═══════════════════════════════════════');
    console.log('🍹 FETCH A RASPBERRY PI DESDE API');
    console.log('═══════════════════════════════════════');
    console.log('URL:', url);
    console.log('Método: POST');
    console.log('Headers:', { 'Content-Type': 'application/json' });
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('═══════════════════════════════════════');
    
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

// ============================================
// ENDPOINT PRINCIPAL
// ============================================

export async function POST(request: NextRequest) {
  let previousLanguage: 'es' | 'en' = 'es';
  
  try {
    const requestData = await request.json();
    const { message, conversationHistory = [] } = requestData;
    previousLanguage = requestData.previousLanguage || 'es';

    // Detectar idioma
    const language = detectLanguage(message, previousLanguage);
    const isFirstMessage = conversationHistory.length === 0;

    console.log('═══════════════════════════════════════');
    console.log('📨 NUEVA PETICIÓN AL CHAT');
    console.log('═══════════════════════════════════════');
    console.log('Mensaje:', message);
    console.log('Idioma detectado:', language);
    console.log('Idioma anterior:', previousLanguage);
    console.log('Primera mensaje:', isFirstMessage);
    console.log('═══════════════════════════════════════');

    // Detectar si hay solicitud de cóctel
    const cocktailRequest = detectCocktailRequest(message, language);

    // Intentar obtener respuesta de IA (Gemini -> Groq -> Fallback)
    let responseText: string | null = null;
    
    // 1. Intentar con Gemini
    responseText = await tryGemini(message, conversationHistory, language, isFirstMessage);
    
    // 2. Si Gemini falla, intentar con Groq
    if (!responseText) {
      console.log('🔄 Cambiando a Groq...');
      responseText = await tryGroq(message, conversationHistory, language, isFirstMessage);
    }
    
    // 3. Si ambos fallan, usar respuesta de respaldo
    if (!responseText) {
      console.log('🔄 Usando respuesta de respaldo (fallback)...');
      responseText = getFallbackResponse(message, language);
    }

    console.log('💬 Respuesta final:', responseText);

    // Preparar respuesta
    const finalResponse: any = {
      text: responseText,
      shouldPrepare: false,
      showConfirmButton: false,
      cocktailId: null,
      recipe: null,
      raspberryResponse: null,
      language
    };

    // Si se detectó un cóctel
    if (cocktailRequest?.cocktailId) {
      const recipe = COCKTAIL_RECIPES[cocktailRequest.cocktailId];
      
      console.log('🍸 Cóctel detectado:', cocktailRequest.cocktailId, '| Confirmado:', cocktailRequest.confirmed);
      
      // Si es confirmación por botón, preparar
      if (cocktailRequest.confirmed && cocktailRequest.isButtonConfirm) {
        finalResponse.shouldPrepare = true;
        finalResponse.recipe = recipe;
        
        console.log('🍹 Enviando receta ID:', recipe.id);
        
        // Enviar al Raspberry Pi solo con el ID
        try {
          const raspberryResult = await sendToRaspberryPi(recipe.id);
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
    console.error('❌ Error en chat API:', error);
    
    const errorMessage = previousLanguage === 'es'
      ? '⚠️ Hubo un error procesando tu mensaje. Por favor intenta de nuevo.'
      : '⚠️ There was an error processing your message. Please try again.';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
