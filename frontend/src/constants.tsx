// Constants for the Wordle With Friends app

// Detect if we're running in a browser environment
const isBrowser = typeof window !== 'undefined';

// Determine if we're in development (localhost) or production (Docker)
const isDevelopment = isBrowser && window.location.hostname === 'localhost' && window.location.port !== '8000';

// Use localhost:8000 for development, relative URLs for production
export const BACKEND_URL = isDevelopment ? 'http://localhost:8000' : '';

export const WS_URL = isDevelopment 
  ? 'ws://localhost:8000/ws/'
  : `ws://${window.location.host}/ws/`;

export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5; 