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
    const parts = token.split('.')
    if (parts.length !== 3) {
      return true
    }
    
    const payload = JSON.parse(atob(parts[1]))
    
    if (!payload.exp) {
      return false
    }
    
    const expirationTime = payload.exp * 1000
    const currentTime = Date.now()
    const isExpired = currentTime > expirationTime
    
    return isExpired
  } catch (error) {
    console.error('Error checking token expiration:', error)
    return true
  }
}

/**
 * WebSocket connection manager
 * @param url - Server URL to connect to
 */
export const connectWebSocket = async function(url: string): Promise<void> {
  if (window.connectingServers && window.connectingServers.has(url)) {
    return
  }
  
  if (window.connectingServers) {
    window.connectingServers.set(url, true)
  }
  
  if (window.activeConnections.has(url)) {
    const existingConnection = window.activeConnections.get(url)
    const readyState = existingConnection?.readyState
    
    if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
      if (window.connectingServers) {
        window.connectingServers.delete(url)
      }
      return
    } else {
      window.activeConnections.delete(url)
      cleanupConnectionTimers(url)
    }
  }
  
  if (window.reconnectTimers && window.reconnectTimers.has(url)) {
    clearTimeout(window.reconnectTimers.get(url))
    window.reconnectTimers.delete(url)
  }

  let ws: WebSocket
  
  try {
    let protocolData: string | null = null
    if (window.userDataManager) {
      try {
        const accessTokens = await window.userDataManager.getAccessTokens()
        const accessToken = accessTokens[url]
        
        if (accessToken && !isTokenExpired(accessToken)) {
          protocolData = 'token-' + accessToken
        } else {
          const refreshTokens = await window.userDataManager.getRefreshTokens()
          const refreshToken = refreshTokens[url]
          if (refreshToken) {
            protocolData = 'refresh-' + refreshToken
          } else {
            const uuid = await window.userDataManager.getUUID()
            protocolData = 'uuid-' + uuid
          }
        }
      } catch (error) {
        console.error('Error getting tokens:', error)
        try {
          const uuid = await window.userDataManager.getUUID()
          protocolData = 'uuid-' + uuid
        } catch (uuidError) {
          console.error('Error getting UUID:', uuidError)
        }
      }
    }
    
    if (protocolData) {
      ws = new WebSocket(url, protocolData)
    } else {
      ws = new WebSocket(url)
    }
    
  } catch (error) {
    console.error('Failed to create WebSocket for ' + url + ': ' + error)
    if (window.connectingServers) {
      window.connectingServers.delete(url)
    }
    setTimeout(function() {
      connectWebSocket(url)
    }, 1000)
    return
  }
  
  setupStandardWebSocketHandlers(ws, url)
}

function setupStandardWebSocketHandlers(ws: WebSocket, url: string): void {
  ws.onopen = function() {
    if (window.connectingServers) {
      window.connectingServers.delete(url)
    }
    
    window.activeConnections.set(url, ws)
    handleConnectionSuccess(url, ws)
  }
  
  ws.onclose = function(event: CloseEvent) {
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
    // First try to parse the message to check if it's a review response
    try {
      const message = JSON.parse(event.data);
      
      // If it's a review response and there's a global handler, let the ConfigMenu handle it
      if (message.event === 'review' && Array.isArray(message.data) && window._handleWebSocketMessage) {
        console.log('WebSocketManager: Passing review response to global handler for URL:', url)
        window._handleWebSocketMessage(url, event)
        return
      }
    } catch (error) {
      // If parsing fails, continue with normal handling
    }
    
    // For all other messages, use the internal handler
    console.log('WebSocketManager: Using internal message handler for URL:', url)
    handleWebSocketMessage(url, event)
  }
}

function handleConnectionSuccess(url: string, ws: WebSocket): void {
  if (window.reconnectTimers.has(url)) {
    clearTimeout(window.reconnectTimers.get(url))
    window.reconnectTimers.delete(url)
  }
  
  window.retryCounts.delete(url)
  
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
      }
    }, 60000)
  )
}

function handleConnectionClose(url: string, event: CloseEvent): void {
  if (window.connectingServers) {
    window.connectingServers.delete(url)
  }
  
  window.activeConnections.delete(url)
  cleanupConnectionTimers(url)
  scheduleReconnection(url, event)
}

function handleConnectionError(url: string, error: Event): void {
  console.error(' WebSocket connection error for ' + url + ': ' +
               (error ? (error as any).message || error : 'Unknown error'))
}

async function handleWebSocketMessage(url: string, event: MessageEvent): Promise<void> {
  let message: WebSocketMessage
  try {
    message = JSON.parse(event.data)
  } catch (error) {
    console.error(' Failed to parse message from ' + url + ': ' + error)
    console.error('Raw message: ' + event.data)
    return
  }
  
  if (message.event === 'token') {
    if (message.data && message.data.token) {
      if (window.userDataManager) {
        try {
          await window.userDataManager.setAccessToken(url, message.data.token)
        } catch (error) {
          console.error(' Failed to store access token for ' + url + ': ' + error)
        }
      }
    } else {
      if (window.userDataManager) {
        try {
          await window.userDataManager.removeAccessToken(url)
        } catch (error) {
          console.error(' Failed to remove access token for ' + url + ': ' + error)
        }
      }
    }
    
  } else if (message.event === 'token_refresh') {
    if (message.data) {
      let tokensStored = 0
      
      if (message.data.token) {
        if (window.userDataManager) {
          try {
            await window.userDataManager.setAccessToken(url, message.data.token)
            tokensStored++
          } catch (error) {
            console.error(' Failed to store access token for ' + url + ': ' + error)
          }
        }
      }
      
      if (message.data.refreshToken) {
        if (window.userDataManager) {
          try {
            await window.userDataManager.setRefreshToken(url, message.data.refreshToken)
            tokensStored++
          } catch (error) {
            console.error(' Failed to store refresh token for ' + url + ': ' + error)
          }
        }
      }
      
      if (message.data.refreshTokenHash) {
        if (window.userDataManager) {
          try {
            await window.userDataManager.setRefreshTokenHash(url, message.data.refreshTokenHash)
          } catch (error) {
            console.error(' Failed to store refresh token hash for ' + url + ': ' + error)
          }
        }
      }
      
      if (tokensStored > 0) {
        try {
          await sendRefreshTokenConfirmation(url)
        } catch (error) {
          console.error('Error sending refresh token confirmation:', error)
        }
      }
    }
    
  } else if (message.event === 'pong') {
    if (window.pongTimers.has(url)) {
      clearTimeout(window.pongTimers.get(url))
      window.pongTimers.delete(url)
    }
    
  } else if (message.event === 'message' &&
            ['image', 'news', 'form', 'html'].indexOf(message.data.messageType) !== -1) {
    handleDisplayMessage(url, message)
  }
}

async function handleAuthenticationRequired(url: string): Promise<void> {
  let wasUsingAccessToken = false
  let refreshTokenAvailable = false
  
  if (window.userDataManager) {
    try {
      const accessTokens = await window.userDataManager.getAccessTokens()
      const accessToken = accessTokens[url]
      
      if (accessToken) {
        wasUsingAccessToken = true
        await window.userDataManager.removeAccessToken(url)
      }
      
      const refreshTokens = await window.userDataManager.getRefreshTokens()
      const refreshToken = refreshTokens[url]
      if (refreshToken) {
        refreshTokenAvailable = true
      }
    } catch (error) {
      console.error('Error checking tokens:', error)
    }
  }
  
  if (wasUsingAccessToken && refreshTokenAvailable) {
    setTimeout(function() {
      connectWebSocket(url)
    }, 100)
  } else if (refreshTokenAvailable) {
    if (window.userDataManager) {
      await window.userDataManager.removeRefreshToken(url)
    }
  }
}

async function sendRefreshTokenConfirmation(url: string): Promise<void> {
  try {
    let refreshTokenHash: string | null = null
    
    if (window.userDataManager) {
      try {
        refreshTokenHash = await window.userDataManager.getRefreshTokenHash(url)
        if (!refreshTokenHash) {
          return
        }
      } catch (error) {
        return
      }
    } else {
      return
    }
    
    if (window.activeConnections.has(url)) {
      const ws = window.activeConnections.get(url)
      if (ws && ws.readyState === WebSocket.OPEN) {
        const confirmationMessage = {
          event: 'confirm_refresh_token',
          data: {
            refreshTokenHash: refreshTokenHash
          }
        }
        
        ws.send(JSON.stringify(confirmationMessage))
      }
    }
  } catch (error) {
    console.error('Error sending refresh token confirmation for server ' + url + ': ' + error)
  }
}

function handleDisplayMessage(url: string, message: WebSocketMessage): void {
  const messageId = message.data.messageId
  const position = message.data.position
  
  if (!window.isDuplicateMessage || !window.isDuplicateMessage(messageId, position)) {
    if (window.Glass) {
      new window.Glass(url, message)
    } else {
      console.error(' Glass class not available')
    }
  } else {
    sendIgnoredNotification(url, message)
  }
}

function sendIgnoredNotification(url: string, message: WebSocketMessage): void {
  const ws = window.activeConnections.get(url)
  if (ws && ws.readyState === WebSocket.OPEN) {
    const out = {
      event: 'notify',
      data: {
        id: message.data.id,
        event: 'ignored',
        response: {
          reason: 'duplicate_message',
          messageId: message.data.messageId
        },
      },
    }
    ws.send(JSON.stringify(out))
  }
}

function cleanupConnectionTimers(url: string): void {
  if (window.pingTimers.has(url)) {
    clearInterval(window.pingTimers.get(url))
    window.pingTimers.delete(url)
  }
  
  if (window.pongTimers.has(url)) {
    clearTimeout(window.pongTimers.get(url))
    window.pongTimers.delete(url)
  }
  
  if (window.reconnectTimers.has(url)) {
    clearTimeout(window.reconnectTimers.get(url))
    window.reconnectTimers.delete(url)
  }
}

// Schedule reconnection with geometric backoff and 5-minute periodic retry
async function scheduleReconnection(url: string, event: CloseEvent): Promise<void> {
  if (window.userDataManager) {
    try {
      const servers = await window.userDataManager.getServers()
      if (!servers.includes(url)) {
        return
      }
    } catch (error) {
      console.error('Error checking server existence:', error)
    }
  }
  
  const currentRetryCount = window.retryCounts.get(url) || 0
  const nextRetryCount = currentRetryCount + 1
  
  if (nextRetryCount > 5) {
    window.retryCounts.set(url, nextRetryCount)
    
    const periodicRetryTime = 300000
    
    console.log('Switching to 5-minute periodic retry for persistent connection failure: ' + url)
    
    window.reconnectTimers.set(
      url,
      setTimeout(async function() {
        if (window.userDataManager) {
          try {
            const servers = await window.userDataManager.getServers()
            if (!servers.includes(url)) {
              return
            }
          } catch (error) {
            console.error('Error checking server existence:', error)
          }
        }
        console.log('Attempting periodic reconnection for: ' + url)
        connectWebSocket(url)
      }, periodicRetryTime)
    )
    return
  }
  
  window.retryCounts.set(url, nextRetryCount)
  
  const baseDelay = 5000
  const maxDelay = 300000
  const backoffTime = Math.min(baseDelay * Math.pow(2, nextRetryCount - 1), maxDelay)
  
  window.reconnectTimers.set(
    url,
    setTimeout(async function() {
      if (window.userDataManager) {
        try {
          const servers = await window.userDataManager.getServers()
          if (!servers.includes(url)) {
            return
          }
        } catch (error) {
          console.error('Error checking server existence:', error)
        }
      }
      connectWebSocket(url)
    }, backoffTime)
  )
}

// Enhanced connection status checking
export function getConnectionStatus(url: string): ConnectionStatus {
  if (!window.activeConnections.has(url)) {
    return { connected: false, connecting: false, type: 'none', readyState: WebSocket.CLOSED, url }
  }
  
  const ws = window.activeConnections.get(url)
  const readyState = ws?.readyState || WebSocket.CLOSED
  
  return {
    connected: readyState === WebSocket.OPEN,
    connecting: readyState === WebSocket.CONNECTING,
    type: 'standard',
    readyState: readyState,
    url: url
  }
}

// Get status of all connections
export function getAllConnectionsStatus(): Record<string, ConnectionStatus> {
  const status: Record<string, ConnectionStatus> = {}
  
  if (window.activeConnections) {
    window.activeConnections.forEach(function(ws, url) {
      status[url] = getConnectionStatus(url)
    })
  }
  
  return status
}

// Force reconnection for a specific URL
export function forceReconnect(url: string): void {
  if (window.activeConnections.has(url)) {
    const ws = window.activeConnections.get(url)
    ws?.close()
  }
  
  cleanupConnectionTimers(url)
  window.retryCounts.delete(url)
  
  setTimeout(function() {
    connectWebSocket(url)
  }, 1000)
}

// Handle network restored event - reconnect all WebSockets
export function handleNetworkRestored(): void {
  let serversToReconnect: string[] = []
  
  if (window.userDataManager) {
    try {
      window.userDataManager.getServers().then(function(servers: string[]) {
        serversToReconnect = servers.slice()
      }).catch(function(error: any) {
        console.error('Error getting servers for reconnection:', error)
      })
    } catch (error) {
      console.error('Error getting servers for reconnection:', error)
    }
  }
  
  if (window.reconnectTimers) {
    window.reconnectTimers.forEach(function(timer, url) {
      if (!serversToReconnect.includes(url)) {
        serversToReconnect.push(url)
      }
    })
  }
  
  if (window.retryCounts) {
    window.retryCounts.clear()
  }
  if (window.reconnectTimers) {
    window.reconnectTimers.forEach(function(timer, url) {
      clearTimeout(timer)
    })
    window.reconnectTimers.clear()
  }
  
  serversToReconnect.forEach(function(url) {
    setTimeout(function() {
      connectWebSocket(url)
    }, 1000)
  })
}

// Listen for network restored events
window.addEventListener('network-restored', handleNetworkRestored)

// Make functions globally available
window.connectWebSocket = connectWebSocket
window.getConnectionStatus = getConnectionStatus
window.getAllConnectionsStatus = getAllConnectionsStatus
window.forceReconnect = forceReconnect
window.handleNetworkRestored = handleNetworkRestored

// Auto-connect to all servers in storage on startup
async function autoConnectToServers(): Promise<void> {
  if (window.userDataManager) {
    try {
      const servers = await window.userDataManager.getServers()
      
      for (const serverUrl of servers) {
        setTimeout(() => {
          connectWebSocket(serverUrl)
        }, 1000)
      }
    } catch (error) {
      console.error('Auto-connect: Error getting servers:', error)
    }
  } else {
    console.log('Auto-connect: UserDataManager not available')
  }
}

// Auto-connect after a short delay to ensure everything is loaded
setTimeout(autoConnectToServers, 2000)