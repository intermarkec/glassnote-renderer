import { BaseService } from './base-service';
import { IWebSocketManager, ConnectionStatus, WebSocketMessage } from './interfaces';
import { serviceRegistry } from './registry';

/**
 * WebSocket Manager Service
 * Handles WebSocket connections, reconnection logic, and message processing
 */
export class WebSocketManagerService extends BaseService implements IWebSocketManager {
  private activeConnections: Map<string, WebSocket> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private pingTimers: Map<string, NodeJS.Timeout> = new Map();
  private pongTimers: Map<string, NodeJS.Timeout> = new Map();
  private retryCounts: Map<string, number> = new Map();
  private connectingServers: Map<string, boolean> = new Map();
  private certificateFailures: Map<string, number> = new Map();

  constructor() {
    super('websocketManager');
  }

  /**
   * Initialize the WebSocket manager
   */
  protected async onInitialize(): Promise<void> {
    // Set up event listeners
    window.addEventListener('network-restored', () => this.handleNetworkRestored());
    
    // Auto-connect to servers after a short delay
    setTimeout(() => this.autoConnectToServers(), 2000);
  }

  /**
   * Clean up the WebSocket manager
   */
  protected async onCleanup(): Promise<void> {
    // Close all connections
    this.activeConnections.forEach((ws, _url) => {
      ws.close();
    });
    
    // Clear all timers
    this.clearAllTimers();
    
    // Clear all maps
    this.activeConnections.clear();
    this.reconnectTimers.clear();
    this.pingTimers.clear();
    this.pongTimers.clear();
    this.retryCounts.clear();
    this.connectingServers.clear();
    this.certificateFailures.clear();
    
    // Clear global activeConnections for backward compatibility
    if (window.activeConnections) {
      window.activeConnections.clear();
    }
  }

  /**
   * Connect to a WebSocket server
   */
  async connect(url: string): Promise<void> {
    if (this.connectingServers.has(url)) {
      return;
    }
    
    this.connectingServers.set(url, true);
    
    // Check for existing connection
    if (this.activeConnections.has(url)) {
      const existingConnection = this.activeConnections.get(url);
      const readyState = existingConnection?.readyState;
      
      if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
        this.connectingServers.delete(url);
        return;
      } else {
        this.activeConnections.delete(url);
        this.cleanupConnectionTimers(url);
      }
    }
    
    // Clear any existing reconnect timer
    if (this.reconnectTimers.has(url)) {
      clearTimeout(this.reconnectTimers.get(url));
      this.reconnectTimers.delete(url);
    }

    let ws: WebSocket;
    
    try {
      const protocolData = await this.getProtocolData(url);
      
      if (protocolData) {
        ws = new WebSocket(url, protocolData);
      } else {
        ws = new WebSocket(url);
      }
      
    } catch (error) {
      console.error('Failed to create WebSocket for ' + url + ': ' + error);
      this.connectingServers.delete(url);
      setTimeout(() => this.connect(url), 1000);
      return;
    }
    
    this.setupWebSocketHandlers(ws, url);
  }

  /**
   * Get connection status for a specific URL
   */
  getStatus(url: string): ConnectionStatus {
    if (!this.activeConnections.has(url)) {
      return { connected: false, connecting: false, type: 'none', readyState: WebSocket.CLOSED, url };
    }
    
    const ws = this.activeConnections.get(url);
    const readyState = ws?.readyState || WebSocket.CLOSED;
    
    return {
      connected: readyState === WebSocket.OPEN,
      connecting: readyState === WebSocket.CONNECTING,
      type: 'standard',
      readyState: readyState,
      url: url
    };
  }

  /**
   * Get status of all connections
   */
  getAllStatuses(): Record<string, ConnectionStatus> {
    const status: Record<string, ConnectionStatus> = {};
    
    this.activeConnections.forEach((_ws, url) => {
      status[url] = this.getStatus(url);
    });
    
    return status;
  }

  /**
   * Force reconnection for a specific URL
   */
  forceReconnect(url: string): void {
    if (this.activeConnections.has(url)) {
      const ws = this.activeConnections.get(url);
      ws?.close();
    }
    
    this.cleanupConnectionTimers(url);
    this.retryCounts.delete(url);
    
    setTimeout(() => {
      this.connect(url);
    }, 1000);
  }

  /**
   * Handle network restored event
   */
  handleNetworkRestored(): void {
    const serversToReconnect: string[] = [];
    
    // Get userDataManager from service registry
    const userDataManager = serviceRegistry.get<any>('userDataManager');
    
    if (userDataManager && typeof userDataManager.getServers === 'function') {
      userDataManager.getServers().then((servers: string[]) => {
        serversToReconnect.push(...servers);
        this.reconnectAllServers(serversToReconnect);
      }).catch((error: any) => {
        console.error('Error getting servers for reconnection:', error);
        this.reconnectAllServers(serversToReconnect);
      });
    } else {
      // Fallback to reconnecting all known servers
      this.activeConnections.forEach((_ws, url) => {
        if (!serversToReconnect.includes(url)) {
          serversToReconnect.push(url);
        }
      });
      this.reconnectAllServers(serversToReconnect);
    }
  }

  // Private helper methods

  private async getProtocolData(url: string): Promise<string | null> {
    // Get userDataManager from service registry
    const userDataManager = serviceRegistry.get<any>('userDataManager');
    
    if (!userDataManager) {
      return null;
    }

    try {
      const accessTokens = await userDataManager.getAccessTokens();
      const accessToken = accessTokens[url];
      
      if (accessToken && !this.isTokenExpired(accessToken)) {
        return 'token-' + accessToken;
      } else {
        const refreshTokens = await userDataManager.getRefreshTokens();
        const refreshToken = refreshTokens[url];
        if (refreshToken) {
          return 'refresh-' + refreshToken;
        } else {
          const uuid = await userDataManager.getUUID();
          return 'uuid-' + uuid;
        }
      }
    } catch (error) {
      console.error('Error getting tokens:', error);
      try {
        const uuid = await userDataManager.getUUID();
        return 'uuid-' + uuid;
      } catch (uuidError) {
        console.error('Error getting UUID:', uuidError);
        return null;
      }
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      
      if (!payload.exp) {
        return false;
      }
      
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      return currentTime > expirationTime;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true;
    }
  }

  private setupWebSocketHandlers(ws: WebSocket, url: string): void {
    ws.onopen = () => {
      this.connectingServers.delete(url);
      this.activeConnections.set(url, ws);
      
      // Update global activeConnections for backward compatibility
      if (!window.activeConnections) {
        window.activeConnections = new Map();
      }
      window.activeConnections.set(url, ws);
      
      this.handleConnectionSuccess(url, ws);
    };
    
    ws.onclose = (event: CloseEvent) => {
      if (event && event.code === 1008) {
        this.handleAuthenticationRequired(url);
      }
      
      this.handleConnectionClose(url, event);
    };
    
    ws.onerror = (error: Event) => {
      console.error('Standard WebSocket error on ' + url + ': ' + JSON.stringify(error));
      this.handleConnectionError(url, error);
    };
    
    ws.onmessage = (event: MessageEvent) => {
      // First try to parse the message to check if it's a review response
      try {
        const message = JSON.parse(event.data);
        
        // If it's a review response and there's a global handler, let the ConfigMenu handle it
        if (message.event === 'review' && Array.isArray(message.data) && (window as any)._handleWebSocketMessage) {
          console.log('WebSocketManager: Passing review response to global handler for URL:', url);
          (window as any)._handleWebSocketMessage(url, event);
          return;
        }
      } catch (error) {
        // If parsing fails, continue with normal handling
      }
      
      // For all other messages, use the internal handler
      console.log('WebSocketManager: Using internal message handler for URL:', url);
      this.handleWebSocketMessage(url, event);
    };
  }

  private handleConnectionSuccess(url: string, ws: WebSocket): void {
    if (this.reconnectTimers.has(url)) {
      clearTimeout(this.reconnectTimers.get(url));
      this.reconnectTimers.delete(url);
    }
    
    this.retryCounts.delete(url);
    
    if (this.pingTimers.has(url)) {
      clearInterval(this.pingTimers.get(url));
      this.pingTimers.delete(url);
    }
    
    this.pingTimers.set(
      url,
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const data = {
            event: 'ping',
            data: { status: (window as any).userStatus || 'unknown' },
          };
          ws.send(JSON.stringify(data));
          
          if (this.pongTimers.has(url)) {
            clearTimeout(this.pongTimers.get(url));
            this.pongTimers.delete(url);
          }
          this.pongTimers.set(
            url,
            setTimeout(() => {
              console.log('Pong timeout - closing connection for: ' + url);
              ws.close();
            }, 30000)
          );
        }
      }, 60000)
    );
  }

  private handleConnectionClose(url: string, event: CloseEvent): void {
    this.connectingServers.delete(url);
    this.activeConnections.delete(url);
    
    // Also remove from global activeConnections for backward compatibility
    if (window.activeConnections) {
      window.activeConnections.delete(url);
    }
    
    this.cleanupConnectionTimers(url);
    this.scheduleReconnection(url, event);
  }

  private handleConnectionError(url: string, error: Event): void {
    console.error(' WebSocket connection error for ' + url + ': ' +
                 (error ? (error as any).message || error : 'Unknown error'));
  }

  private async handleWebSocketMessage(url: string, event: MessageEvent): Promise<void> {
    let message: WebSocketMessage;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.error(' Failed to parse message from ' + url + ': ' + error);
      console.error('Raw message: ' + event.data);
      return;
    }
    
    // Get userDataManager from service registry
    const userDataManager = serviceRegistry.get<any>('userDataManager');
    
    if (message.event === 'token') {
      if (message.data && message.data.token) {
        if (userDataManager) {
          try {
            await userDataManager.setAccessToken(url, message.data.token);
          } catch (error) {
            console.error(' Failed to store access token for ' + url + ': ' + error);
          }
        }
      } else {
        if (userDataManager) {
          try {
            await userDataManager.removeAccessToken(url);
          } catch (error) {
            console.error(' Failed to remove access token for ' + url + ': ' + error);
          }
        }
      }
      
    } else if (message.event === 'token_refresh') {
      if (message.data) {
        let tokensStored = 0;
        
        if (message.data.token) {
          if (userDataManager) {
            try {
              await userDataManager.setAccessToken(url, message.data.token);
              tokensStored++;
            } catch (error) {
              console.error(' Failed to store access token for ' + url + ': ' + error);
            }
          }
        }
        
        if (message.data.refreshToken) {
          if (userDataManager) {
            try {
              await userDataManager.setRefreshToken(url, message.data.refreshToken);
              tokensStored++;
            } catch (error) {
              console.error(' Failed to store refresh token for ' + url + ': ' + error);
            }
          }
        }
        
        if (message.data.refreshTokenHash) {
          if (userDataManager) {
            try {
              await userDataManager.setRefreshTokenHash(url, message.data.refreshTokenHash);
            } catch (error) {
              console.error(' Failed to store refresh token hash for ' + url + ': ' + error);
            }
          }
        }
        
        if (tokensStored > 0) {
          try {
            await this.sendRefreshTokenConfirmation(url);
          } catch (error) {
            console.error('Error sending refresh token confirmation:', error);
          }
        }
      }
      
    } else if (message.event === 'pong') {
      if (this.pongTimers.has(url)) {
        clearTimeout(this.pongTimers.get(url));
        this.pongTimers.delete(url);
      }
      
    } else if (message.event === 'message' &&
              ['image', 'news', 'form', 'html'].indexOf(message.data.messageType) !== -1) {
      this.handleDisplayMessage(url, message);
    }
  }

  private async handleAuthenticationRequired(url: string): Promise<void> {
    // Get userDataManager from service registry
    const userDataManager = serviceRegistry.get<any>('userDataManager');
    
    if (!userDataManager) {
      return;
    }

    let wasUsingAccessToken = false;
    let refreshTokenAvailable = false;
    
    try {
      const accessTokens = await userDataManager.getAccessTokens();
      const accessToken = accessTokens[url];
      
      if (accessToken) {
        wasUsingAccessToken = true;
        await userDataManager.removeAccessToken(url);
      }
      
      const refreshTokens = await userDataManager.getRefreshTokens();
      const refreshToken = refreshTokens[url];
      if (refreshToken) {
        refreshTokenAvailable = true;
      }
    } catch (error) {
      console.error('Error checking tokens:', error);
    }
    
    if (wasUsingAccessToken && refreshTokenAvailable) {
      setTimeout(() => {
        this.connect(url);
      }, 100);
    } else if (refreshTokenAvailable) {
      await userDataManager.removeRefreshToken(url);
    }
  }

  private async sendRefreshTokenConfirmation(url: string): Promise<void> {
    try {
      // Get userDataManager from service registry
      const userDataManager = serviceRegistry.get<any>('userDataManager');
      
      if (!userDataManager) {
        return;
      }

      let refreshTokenHash: string | null = null;
      
      try {
        refreshTokenHash = await userDataManager.getRefreshTokenHash(url);
        if (!refreshTokenHash) {
          return;
        }
      } catch (error) {
        return;
      }
      
      if (this.activeConnections.has(url)) {
        const ws = this.activeConnections.get(url);
        if (ws && ws.readyState === WebSocket.OPEN) {
          const confirmationMessage = {
            event: 'confirm_refresh_token',
            data: {
              refreshTokenHash: refreshTokenHash
            }
          };
          
          ws.send(JSON.stringify(confirmationMessage));
        }
      }
    } catch (error) {
      console.error('Error sending refresh token confirmation for server ' + url + ': ' + error);
    }
  }

  private handleDisplayMessage(url: string, message: WebSocketMessage): void {
    const messageId = message.data.messageId;
    const position = message.data.position;
    
    // Check for duplicate message
    const isDuplicate = (window as any).isDuplicateMessage 
      ? (window as any).isDuplicateMessage(messageId, position)
      : false;
    
    if (!isDuplicate) {
      if ((window as any).Glass) {
        new (window as any).Glass(url, message);
      } else {
        console.error(' Glass class not available');
      }
    } else {
      this.sendIgnoredNotification(url, message);
    }
  }

  private sendIgnoredNotification(url: string, message: WebSocketMessage): void {
    const ws = this.activeConnections.get(url);
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
      };
      ws.send(JSON.stringify(out));
    }
  }

  private cleanupConnectionTimers(url: string): void {
    if (this.pingTimers.has(url)) {
      clearInterval(this.pingTimers.get(url));
      this.pingTimers.delete(url);
    }
    
    if (this.pongTimers.has(url)) {
      clearTimeout(this.pongTimers.get(url));
      this.pongTimers.delete(url);
    }
    
    if (this.reconnectTimers.has(url)) {
      clearTimeout(this.reconnectTimers.get(url));
      this.reconnectTimers.delete(url);
    }
  }

  private async scheduleReconnection(url: string, _event: CloseEvent): Promise<void> {
    // Get userDataManager from service registry
    const userDataManager = serviceRegistry.get<any>('userDataManager');
    
    if (userDataManager && typeof userDataManager.getServers === 'function') {
      try {
        const servers = await userDataManager.getServers();
        if (!servers.includes(url)) {
          return;
        }
      } catch (error) {
        console.error('Error checking server existence:', error);
      }
    }
    
    const currentRetryCount = this.retryCounts.get(url) || 0;
    const nextRetryCount = currentRetryCount + 1;
    
    if (nextRetryCount > 5) {
      this.retryCounts.set(url, nextRetryCount);
      
      const periodicRetryTime = 300000;
      
      console.log('Switching to 5-minute periodic retry for persistent connection failure: ' + url);
      
      this.reconnectTimers.set(
        url,
        setTimeout(async () => {
          if (userDataManager) {
            try {
              const servers = await userDataManager.getServers();
              if (!servers.includes(url)) {
                return;
              }
            } catch (error) {
              console.error('Error checking server existence:', error);
            }
          }
          console.log('Attempting periodic reconnection for: ' + url);
          this.connect(url);
        }, periodicRetryTime)
      );
      return;
    }
    
    this.retryCounts.set(url, nextRetryCount);
    
    const baseDelay = 5000;
    const maxDelay = 300000;
    const backoffTime = Math.min(baseDelay * Math.pow(2, nextRetryCount - 1), maxDelay);
    
    this.reconnectTimers.set(
      url,
      setTimeout(async () => {
        if (userDataManager) {
          try {
            const servers = await userDataManager.getServers();
            if (!servers.includes(url)) {
              return;
            }
          } catch (error) {
            console.error('Error checking server existence:', error);
          }
        }
        this.connect(url);
      }, backoffTime)
    );
  }

  private clearAllTimers(): void {
    // Clear ping timers
    this.pingTimers.forEach((timer) => {
      clearInterval(timer);
    });
    
    // Clear pong timers
    this.pongTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    
    // Clear reconnect timers
    this.reconnectTimers.forEach((timer) => {
      clearTimeout(timer);
    });
  }

  private reconnectAllServers(servers: string[]): void {
    // Clear retry counts
    this.retryCounts.clear();
    
    // Clear reconnect timers
    this.reconnectTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.reconnectTimers.clear();
    
    // Reconnect to all servers
    servers.forEach((url) => {
      setTimeout(() => {
        this.connect(url);
      }, 1000);
    });
  }

  private async autoConnectToServers(): Promise<void> {
    // Get userDataManager from service registry
    const userDataManager = serviceRegistry.get<any>('userDataManager');
    
    if (userDataManager && typeof userDataManager.getServers === 'function') {
      try {
        const servers = await userDataManager.getServers();
        
        for (const serverUrl of servers) {
          setTimeout(() => {
            this.connect(serverUrl);
          }, 1000);
        }
      } catch (error) {
        console.error('Auto-connect: Error getting servers:', error);
      }
    } else {
      console.log('Auto-connect: UserDataManager not available');
    }
  }
}