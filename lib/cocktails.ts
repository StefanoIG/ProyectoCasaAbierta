// ============================================
// lib/cocktails.ts - Configuración Centralizada de Cócteles y Bombas
// ============================================

// Configuración de bombas IoT (Raspberry Pi)
export const PUMP_CONFIG = {
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
export const COCKTAIL_RECIPES = {
  mojito: {
    name: 'Mojito',
    description: 'Ron blanco, lima, menta y soda',
    ingredients: {
      "ron": 50,
      "jugo_lima": 30,
      "soda": 100
    }
  },
  margarita: {
    name: 'Margarita',
    description: 'Tequila, triple sec y lima',
    ingredients: {
      "tequila": 50,
      "triple_sec": 25,
      "jugo_lima": 25
    }
  },
  vodka_soda: {
    name: 'Vodka Soda',
    description: 'Vodka con soda y un toque de lima',
    ingredients: {
      "vodka": 50,
      "soda": 120,
      "jugo_lima": 15
    }
  },
  cuba_libre: {
    name: 'Cuba Libre',
    description: 'Ron, lima y soda',
    ingredients: {
      "ron": 60,
      "jugo_lima": 20,
      "soda": 120
    }
  },
  paloma: {
    name: 'Paloma',
    description: 'Tequila, lima y soda',
    ingredients: {
      "tequila": 60,
      "jugo_lima": 30,
      "soda": 110
    }
  },
  vodka_citrus: {
    name: 'Vodka Citrus',
    description: 'Vodka, triple sec, lima y soda',
    ingredients: {
      "vodka": 45,
      "triple_sec": 15,
      "jugo_lima": 20,
      "soda": 100
    }
  },
  tequila_sunrise: {
    name: 'Tequila Sunrise',
    description: 'Tequila, lima y soda',
    ingredients: {
      "tequila": 50,
      "jugo_lima": 40,
      "soda": 90
    }
  },
  ron_collins: {
    name: 'Ron Collins',
    description: 'Ron, lima y soda',
    ingredients: {
      "ron": 50,
      "jugo_lima": 35,
      "soda": 115
    }
  }
};

// Mapeo de ingredientes a bombas
export function getIngredientPump(ingredient: string): string | null {
  for (const [pumpKey, pumpConfig] of Object.entries(PUMP_CONFIG)) {
    if (pumpConfig.ingredient === ingredient) {
      return pumpKey;
    }
  }
  return null;
}

// Obtener lista de cócteles disponibles
export function getAvailableCocktails() {
  return Object.entries(COCKTAIL_RECIPES).map(([id, recipe]) => ({
    id,
    ...recipe
  }));
}

// Mapeo de ingredientes a emotes
export const INGREDIENT_EMOTES: { [key: string]: string } = {
  'ron': '🥃',
  'vodka': '🧊',
  'tequila': '🌵',
  'jugo_lima': '🍋',
  'triple_sec': '🍊',
  'soda': '💧',
};
