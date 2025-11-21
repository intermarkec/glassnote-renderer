import { WebSocketMessage, ConnectionStatus, TokenData } from '../utils/global'

// Connection tracking
(function() {
  window.certificateFailures = new Map<string, number>() // Kept for compatibility but not used
  window.connectingServers = new Map<string, boolean>() // Track servers that are currently connecting
})()

/**
 * Check if a JWT token is expired
 * @param token - JWT token to check
 * @returns True if token is expired, false otherwise
 */
function isTokenExpired(token: string): boolean {
  try {
    // JWT tokens have 3 parts separated by dots: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      return true // Consider invalid tokens as expired
    }
    
    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]))
    
    // Check if token has expiration claim
    if (!payload.exp) {
      return false // If no expiration, consider it valid
    }
    
    // Convert expiration time from seconds to milliseconds
    const expirationTime = payload.exp * 1000
    const currentTime = Date.now()
    
    // Token is expired if current time is past expiration time
    const isExpired = currentTime > expirationTime
    
    return isExpired
  } catch (error) {
    console.error('Error checking token expiration:', error)
    return true // Consider tokens with errors as expired
  }
}

/**
 * WebSocket connection manager
 * @param url - Server URL to connect to
 */
export const connectWebSocket = async function(url: string): Promise<void> {
  // Prevent multiple simultaneous connection attempts to the same server
  if (window.connectingServers && window.connectingServers.has(url)) {
    return
  }
  
  // Mark this server as connecting
  if (window.connectingServers) {
    window.connectingServers.set(url, true)
  }
  
  // Enhanced duplicate connection detection
  if (window.activeConnections.has(url)) {
    const existingConnection = window.activeConnections.get(url)
    const readyState = existingConnection?.readyState
    
    // Skip if connection is already established or establishing
    if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
      // Remove from connecting servers since we're not actually connecting
      if (window.connectingServers) {
        window.connectingServers.delete(url)
      }
      return
    } else {
      // Clean up the closed connection
      window.activeConnections.delete(url)
      cleanupConnectionTimers(url)
    }
  }
  
  // Additional check: if there's a pending reconnect timer, cancel it since we're connecting now
  if (window.reconnectTimers && window.reconnectTimers.has(url)) {
    clearTimeout(window.reconnectTimers.get(url))
    window.reconnectTimers.delete(url)
  }

  let ws: WebSocket
  
  try {
    // Get token for authentication protocol - prefer access token if available and not expired
    let protocolData: string | null = null
    if (window.userDataManager) {
      try {
        // First try to use access token if available and not expired
        const accessTokens = await window.userDataManager.getAccessTokens()
        const accessToken = accessTokens[url]
        
        if (accessToken && !isTokenExpired(accessToken)) {
          // Create protocol data with access token: 'token-{token}'
          protocolData = 'token-' + accessToken
        } else {
          // Use refresh token if access token is expired or not available
          const refreshTokens = await window.userDataManager.getRefreshTokens()
          const refreshToken = refreshTokens[url]
          if (refreshToken) {
            // Create protocol data with refresh token: 'refresh-{token}'
            protocolData = 'refresh-' + refreshToken
          } else {
            // No tokens available, use UUID for initial registration
            const uuid = await window.userDataManager.getUUID()
            protocolData = 'uuid-' + uuid
          }
        }
      } catch (error) {
        console.error('Error getting tokens:', error)
        // Fallback to UUID if token retrieval fails
        try {
          const uuid = await window.userDataManager.getUUID()
          protocolData = 'uuid-' + uuid
        } catch (uuidError) {
          console.error('Error getting UUID:', uuidError)
        }
      }
    }
    
    // Create WebSocket with authentication protocol if available
    if (protocolData) {
      ws = new WebSocket(url, protocolData)
    } else {
      ws = new WebSocket(url)
    }
    
  } catch (error) {
    console.error('Failed to create WebSocket for ' + url + ': ' + error)
    // Remove from connecting servers on error
    if (window.connectingServers) {
      window.connectingServers.delete(url)
    }
    // Even if it fails, try to reconnect immediately
    setTimeout(function() {
      connectWebSocket(url)
    }, 1000)
    return
  }
  
  // Set up WebSocket handlers
  setupStandardWebSocketHandlers(ws, url)
  // Connection will be added to activeConnections in onopen handler
}

// Setup handlers for standard WebSocket
function setupStandardWebSocketHandlers(ws: WebSocket, url: string): void {
  ws.onopen = function() {
    // Log protocol details for debugging authentication
    if (ws.protocol) {
      try {
        // Try to decode the protocol data if it's Base64 encoded
        const decodedProtocol = atob(ws.protocol.replace(/-/g, '='))
      } catch (error) {
        console.error('Protocol data is not Base64 encoded or cannot be decoded')
      }
    } else {
      console.log('No WebSocket protocol received from server')
    }
    
    // Remove from connecting servers since connection is now established
    if (window.connectingServers) {
      window.connectingServers.delete(url)
    }
    
    // Add to active connections only after successful connection
    window.activeConnections.set(url, ws)
    
    handleConnectionSuccess(url, ws)
  }
  
  ws.onclose = function(event: CloseEvent) {
    // Handle authentication required (code 1008)
    if (event && event.code === 1008) {
      handleAuthenticationRequired(url)
    }
    
    handleConnectionClose(url, event)
  }
  
  ws.onerror = function(error: Event) {
    console.error('Standard WebSocket error on ' + url + ': ' + JSON.stringify(error))
    handleConnectionError(url, error)
  }
  
  ws.onmessage = function(event: MessageEvent) {
    handleWebSocketMessage(url, event)
  }
}

// Handle successful connection
function handleConnectionSuccess(url: string, ws: WebSocket): void {
  // Clear any pending reconnect timer
  if (window.reconnectTimers.has(url)) {
    clearTimeout(window.reconnectTimers.get(url))
    window.reconnectTimers.delete(url)
  }
  
  // Reset retry counter on successful connection
  window.retryCounts.delete(url)
  
  // Start ping interval
  // Clean up any existing ping timer first
  if (window.pingTimers.has(url)) {
    clearInterval(window.pingTimers.get(url))
    window.pingTimers.delete(url)
  }
  
  window.pingTimers.set(
    url,
    setInterval(function() {
      if (ws.readyState === WebSocket.OPEN) {
        const data = {
          event: 'ping',
          data: { status: window.userStatus },
        }
        ws.send(JSON.stringify(data))
        
        // Set pong timeout (30 seconds - more reasonable than 10 seconds)
        if (window.pongTimers.has(url)) {
          clearTimeout(window.pongTimers.get(url))
          window.pongTimers.delete(url)
        }
        window.pongTimers.set(
          url,
          setTimeout(function() {
            console.log('Pong timeout - closing connection for: ' + url)
            ws.close()
          }, 30000)
        )
      } else {
        console.log('Skipping ping - connection not open for: ' + url + ', state: ' + ws.readyState)
      }
    }, 60000)
  )
  
  // Authentication is handled through WebSocket protocol handshake
  // No additional auth message needed
}