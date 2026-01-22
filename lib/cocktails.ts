// ============================================
// lib/cocktails.ts - Configuración Centralizada de Cócteles y Bombas
// ============================================

// Importar configuración desde pi.json
import piConfig from '@/pi.json';

// Interfaz para los cócteles
interface Cocktail {
  id: number;
  name: string;
  description: string;
  ingredients: Array<{ pump: string; ml: number }>;
}

// Convertir el menú de pi.json a un objeto indexado por ID
const cocktailsById: { [key: string]: Cocktail } = {};
piConfig.menu.forEach((cocktail) => {
  cocktailsById[cocktail.id.toString()] = cocktail;
});

// Exportar recetas de cócteles disponibles - directamente desde pi.json
export const COCKTAIL_RECIPES = cocktailsById;

// Configuración de bombas desde pi.json
export const PUMP_CONFIG = piConfig.config;

// Obtener lista de cócteles disponibles
export function getAvailableCocktails() {
  return piConfig.menu;
}

// Obtener ingredientes disponibles
export function getAvailableIngredients() {
  return Object.entries(piConfig.config).map(([key, pump]) => ({
    pump: key,
    label: pump.label,
    pin: pump.pin
  }));
}

