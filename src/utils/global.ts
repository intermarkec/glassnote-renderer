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

// Make global functions available
declare global {
  interface Window {
    getURLParameter: (name: string) => string | null
  }
}