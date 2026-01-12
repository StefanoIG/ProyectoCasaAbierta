// ============================================
// hooks/geminiConfig.js - Barman AI Configuration
// ============================================
const { GoogleGenAI } = require('@google/genai');

// NOTA: Las recetas y configuración de bombas ahora están centralizadas en lib/cocktails.ts
// Este archivo mantiene compatibilidad para funciones que aún lo requieran

const API_CONFIG = {
  GEMINI: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    models: {
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro'
    },
    defaultModel: 'gemini-2.5-flash',
    endpoints: {
      generateContent: (model) => `/models/${model}:generateContent`
    },
    defaultParams: {
      temperature: 0.7,
      topP: 0.8,
      maxOutputTokens: 500 // Límite aumentado para respuestas más descriptivas
    }
  }
};

const RATE_LIMITS = {
  GEMINI: {
    requestsPerMinute: 60,
    requestsPerDay: 1000
  }
};

module.exports = {
  API_CONFIG,
  RATE_LIMITS
};