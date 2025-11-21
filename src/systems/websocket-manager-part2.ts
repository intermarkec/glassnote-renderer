// Handle connection close
function handleConnectionClose(url: string, event: CloseEvent): void {
  // Remove from connecting servers if still present
  if (window.connectingServers) {
    window.connectingServers.delete(url)
  }
  
  window.activeConnections.delete(url)
  
  // Clean up timers
  cleanupConnectionTimers(url)
  
  // Handle reconnection logic
  scheduleReconnection(url, event)
}

// Handle connection errors - ignore all errors completely
function handleConnectionError(url: string, error: Event): void {
  console.error(' WebSocket connection error for ' + url + ': ' +
               (error ? (error as any).message || error : 'Unknown error'))
  
  // IGNORE ALL ERRORS - just log them but don't take any action
  // The connection will automatically try to reconnect through the onclose handler
}

// Handle WebSocket messages
async function handleWebSocketMessage(url: string, event: MessageEvent): Promise<void> {
  let message: WebSocketMessage
  try {
    message = JSON.parse(event.data)
  } catch (error) {
    console.error(' Failed to parse message from ' + url + ': ' + error)
    console.error('Raw message: ' + event.data)
    return
  }
  
  // Handle different message types
  if (message.event === 'token') {
    if (message.data && message.data.token) {
      // Store access token using centralized user data manager
      if (window.userDataManager) {
        try {
          await window.userDataManager.setAccessToken(url, message.data.token)
        } catch (error) {
          console.error(' Failed to store access token for ' + url + ': ' + error)
        }
      } else {
        console.error(' UserDataManager not available, cannot store access token')
      }
    } else {
      console.error(' Failed to store access token for ' + url)
      // Remove access token using centralized user data manager
      if (window.userDataManager) {
        try {
          await window.userDataManager.removeAccessToken(url)
        } catch (error) {
          console.error(' Failed to remove access token for ' + url + ': ' + error)
        }
      }
    }
    
  } else if (message.event === 'token_refresh') {
    // Handle token refresh response - can contain token, refreshToken, refreshTokenHash, or both
    if (message.data) {
      let tokensStored = 0
      let storedRefreshToken: string | null = null
      
      // Store access token if available
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
      
      // Store refresh token if available
      if (message.data.refreshToken) {
        storedRefreshToken = message.data.refreshToken
        if (window.userDataManager) {
          try {
            await window.userDataManager.setRefreshToken(url, message.data.refreshToken)
            tokensStored++
          } catch (error) {
            console.error(' Failed to store refresh token for ' + url + ': ' + error)
          }
        }
      }
      
      // Store refreshTokenHash if provided by server
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
        // Send confirmation message with refresh token hash
        // Use stored refreshTokenHash from registration
        try {
          await sendRefreshTokenConfirmation(url)
        } catch (error) {
          console.error('Error sending refresh token confirmation:', error)
        }
      } else {
        console.log(' Token refresh message received but no valid tokens found in payload for ' + url)
      }
    } else {
      console.error(' Invalid token refresh message format for ' + url + ' - missing data field')
    }
    
  } else if (message.event === 'pong') {
    // Clear pong timeout
    if (window.pongTimers.has(url)) {
      clearTimeout(window.pongTimers.get(url))
      window.pongTimers.delete(url)
    }
    
  } else if (message.event === 'auth' && message.data && message.data.value === true) {
    // Authentication successful - no action needed
  } else if (message.event === 'desiredVersion') {
    // Version information - no action needed
  } else if (message.event === 'message' &&
            ['image', 'news', 'form', 'html'].indexOf(message.data.messageType) !== -1) {
    handleDisplayMessage(url, message)
    
  } else {
    console.log(' Received unhandled message from ' + url + ': ' + JSON.stringify(message, null, 2))
  }
}

// Handle authentication required (code 1008)
async function handleAuthenticationRequired(url: string): Promise<void> {
  // Check what type of token was used in the failed authentication
  let wasUsingAccessToken = false
  let refreshTokenAvailable = false
  
  if (window.userDataManager) {
    try {
      // Check if we were using access token
      const accessTokens = await window.userDataManager.getAccessTokens()
      const accessToken = accessTokens[url]
      
      if (accessToken) {
        wasUsingAccessToken = true
        // Remove the failed access token
        await window.userDataManager.removeAccessToken(url)
      }
      
      // Check if we have a refresh token to try
      const refreshTokens = await window.userDataManager.getRefreshTokens()
      const refreshToken = refreshTokens[url]
      if (refreshToken) {
        refreshTokenAvailable = true
      } else {
        console.log('No refresh token found for server: ' + url)
      }
    } catch (error) {
      console.error('Error checking tokens:', error)
    }
  }
  
  if (wasUsingAccessToken && refreshTokenAvailable) {
    // Authentication with access token failed, but we have a refresh token
    // Try to reconnect immediately using refresh token
    
    // Schedule immediate reconnection (after a short delay to avoid race conditions)
    setTimeout(function() {
      connectWebSocket(url)
    }, 100)
    
  } else if (refreshTokenAvailable) {
    // We were already using refresh token and it failed - token may be invalid
    
    // Remove refresh token (failed refresh token) but keep server for potential re-registration
    if (window.userDataManager) {
      await window.userDataManager.removeRefreshToken(url)
    }
    
    // Don't remove server immediately - keep it for potential re-registration
    // The server will remain in storage but without valid tokens
  } else {
    // No refresh token available - server registration may be needed
    
    // Don't remove server - keep it for potential re-registration
    // The server will remain in storage but without valid tokens
  }
}

/**
 * Send refresh token confirmation message to server using stored refreshTokenHash
 * @param url - Server URL
 */
async function sendRefreshTokenConfirmation(url: string): Promise<void> {
  try {
    let refreshTokenHash: string | null = null
    
    // Get stored refreshTokenHash from server
    if (window.userDataManager) {
      try {
        refreshTokenHash = await window.userDataManager.getRefreshTokenHash(url)
        if (!refreshTokenHash) {
          return // Don't send confirmation if no hash is available
        }
      } catch (error) {
        console.error('DEBUG: Error getting stored refresh token hash:', error)
        return
      }
    } else {
      return
    }
    
    // Get the active WebSocket connection
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
    console.error('DEBUG: Error sending refresh token confirmation for server ' + url + ': ' + error)
  }
}

// Handle display messages (Glass system)
function handleDisplayMessage(url: string, message: WebSocketMessage): void {
  const messageId = message.data.messageId
  const position = message.data.position
  
  // Check for duplicate messages (same messageId AND same position)
  if (!window.isDuplicateMessage || !window.isDuplicateMessage(messageId, position)) {
    
    // Always use the unified queue system - it will handle needPresent automatically
    if (window.Glass) {
      // Use the modified Glass constructor that goes through unified queue
      new window.Glass(url, message)
    } else {
      console.error(' Glass class not available')
    }
  } else {
    // Send IGNORED notification via WebSocket
    sendIgnoredNotification(url, message)
  }
}

// Send IGNORED notification for duplicate messages
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

// Clean up connection timers
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