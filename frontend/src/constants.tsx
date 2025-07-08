// Constants for the Wordle With Friends app

// Detect if we're running in a browser environment
const isBrowser = typeof window !== 'undefined';

// Determine if we're in development (localhost) or production (Docker)
const isDevelopment = isBrowser && window.location.hostname === 'localhost' && window.location.port !== '8000';

// Use localhost:8000 for development, current origin for production
export const BACKEND_URL = isDevelopment 
  ? 'http://localhost:8000' 
  : (isBrowser ? window.location.origin : '');

// Use secure WebSocket (wss://) for HTTPS pages, regular WebSocket (ws://) for HTTP
export const WS_URL = isDevelopment 
  ? 'ws://localhost:8000/ws/'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/`;

export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5; 