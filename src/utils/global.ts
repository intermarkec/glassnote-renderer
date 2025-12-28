// Function to get parameter from URL (compatible with older browsers)
export function getURLParameter(name: string): string | null {
  try {
    // Modern browsers: Use URLSearchParams if available
    if (window.URLSearchParams) {
      const urlParams = new URLSearchParams(window.location.search)
      const value = urlParams.get(name)
      if (value) {
        return value
      }
    } else {
      // Fallback for older browsers: parse query string manually
      const queryString = window.location.search.substring(1)
      const params = queryString.split('&')
      for (let i = 0; i < params.length; i++) {
        const pair = params[i].split('=')
        if (pair[0] === name && pair[1]) {
          const value = decodeURIComponent(pair[1])
          return value
        }
      }
    }
    return null
  } catch (error) {
    console.error('Error parsing URL parameter ' + name + ': ' + error)
    return null
  }
}

// Make function globally available
window.getURLParameter = getURLParameter

// Interface for glass data
export interface GlassData {
  url: string | null
  message: {
    event: string
    data: {
      id: number
      messageId: string
      type?: string
      uploads?: string
      position: string
      duration?: number
      transparency?: string
      isUserDevice?: boolean
      needPresent?: boolean
      askConfirmation?: boolean
      isAsyncronous?: boolean
      baseUrl?: string
      parameters?: string
      messageType: string
    }
  }
  timestamp: number
}

// Interface for WebSocket message
export interface WebSocketMessage {
  event: string
  data: any
}

// Interface for connection status
export interface ConnectionStatus {
  connected: boolean
  connecting: boolean
  type: string
  readyState: number
  url: string
}

// Interface for token data
export interface TokenData {
  token?: string
  refreshToken?: string
  refreshTokenHash?: string
}

// Platform detection
export type PlatformContext = 'android' | 'electron' | 'browser';

export function getPlatformContext(): PlatformContext {
  if (typeof window.AndroidBridge !== 'undefined') {
    return 'android';
  } else if (window.electronAPI && typeof window.electronAPI.receive === 'function') {
    return 'electron';
  } else {
    return 'browser';
  }
}

// Make platform context available globally
window.getPlatformContext = getPlatformContext;

// Helper function to check if running in browser mode
export function isBrowserMode(): boolean {
  return getPlatformContext() === 'browser';
}

// Helper function to check if running in electron mode
export function isElectronMode(): boolean {
  return getPlatformContext() === 'electron';
}

// Helper function to check if running in android mode
export function isAndroidMode(): boolean {
  return getPlatformContext() === 'android';
}

// Make helper functions globally available
window.isBrowserMode = isBrowserMode;
window.isElectronMode = isElectronMode;
window.isAndroidMode = isAndroidMode;

// Make global functions available
declare global {
  interface Window {
    getURLParameter: (name: string) => string | null
    getPlatformContext: () => PlatformContext
    isBrowserMode: () => boolean
    isElectronMode: () => boolean
    isAndroidMode: () => boolean
  }
}