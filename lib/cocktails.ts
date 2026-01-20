// ============================================
// lib/cocktails.ts - Configuración Centralizada de Cócteles y Bombas
// ============================================

// Importar configuración desde pi.json
import piConfig from '@/pi.json';

// Configuración de bombas IoT (Raspberry Pi) - desde pi.json
export const PUMP_CONFIG = {
  pump_1: { 
    id: 1, 
    ingredient: piConfig.pumps.pump_1.value, 
    gpio_pin: piConfig.pumps.pump_1.pin,
    ml_per_second: 1 / piConfig.config.segundos_por_ml // Convertir segundos_por_ml a ml_per_second
  },
  pump_2: { 
    id: 2, 
    ingredient: piConfig.pumps.pump_2.value, 
    gpio_pin: piConfig.pumps.pump_2.pin,
    ml_per_second: 1 / piConfig.config.segundos_por_ml
  },
  pump_3: { 
    id: 3, 
    ingredient: piConfig.pumps.pump_3.value, 
    gpio_pin: piConfig.pumps.pump_3.pin,
    ml_per_second: 1 / piConfig.config.segundos_por_ml
  },
  pump_4: { 
    id: 4, 
    ingredient: piConfig.pumps.pump_4.value, 
    gpio_pin: piConfig.pumps.pump_4.pin,
    ml_per_second: 1 / piConfig.config.segundos_por_ml
  },
  pump_5: { 
    id: 5, 
    ingredient: piConfig.pumps.pump_5.value, 
    gpio_pin: piConfig.pumps.pump_5.pin,
    ml_per_second: 1 / piConfig.config.segundos_por_ml
  },
  pump_6: { 
    id: 6, 
    ingredient: piConfig.pumps.pump_6.value, 
    gpio_pin: piConfig.pumps.pump_6.pin,
    ml_per_second: 1 / piConfig.config.segundos_por_ml
  }
};

// Recetas de cócteles disponibles - directamente desde pi.json
export const COCKTAIL_RECIPES = piConfig.recipes;

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
  'bacardi': '🥃',
  'tequila': '🌵',
  'jugo': '🧃',
  'cola': '🥤',
};
