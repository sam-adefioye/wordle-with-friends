// Constants for the Wordle With Friends app

// Detect if we're running in a browser environment
const isBrowser = typeof window !== 'undefined';

// Determine if we're in development (localhost) or production (Docker)
const isDevelopment = isBrowser && window.location.hostname === 'localhost' && window.location.port === '3000';

// Allow environment variable override for backend URL
const getBackendUrl = () => {
  if (isDevelopment) {
    return 'http://localhost:8000';
  }
  
  // Check for environment variable (useful for custom deployments)
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Default to same origin (reverse proxy setup)
  return isBrowser ? window.location.origin : '';
};

export const BACKEND_URL = getBackendUrl();

// Use secure WebSocket (wss://) for HTTPS pages, regular WebSocket (ws://) for HTTP
const getWebSocketUrl = () => {
  if (isDevelopment) {
    return 'ws://localhost:8000/ws/';
  }
  
  // Check for environment variable
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }
  
  // Default to same origin with /ws/ path
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/`;
};

export const WS_URL = getWebSocketUrl();

// Game constants
export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5; 