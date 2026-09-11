import { BaseService } from './base-service';
import { IWebSocketManager, ConnectionStatus, WebSocketMessage } from './interfaces';
import { serviceRegistry } from './registry';
import { esPreview } from '../utils/preview';

interface ServerHealth {
  firstSeenAt: number;
  lastConnectedAt: number | null;
  failedAttempts: number;
}

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
  private connectingServers: Map<string, number> = new Map();
  private certificateFailures: Map<string, number> = new Map();
  // Ultima señal de vida de cada servidor: cualquier mensaje recibido, no solo el pong.
  private lastSeenAt: Map<string, number> = new Map();
  private watchdog: NodeJS.Timeout | null = null;
  private lastTickAt = 0;

  // El vigilante mira cada 30 s. Con un ping por minuto, 150 s sin una sola respuesta
  // son dos pings al vacio: el socket esta muerto. Y un salto de reloj de mas de dos
  // minutos entre dos vueltas no puede ser otra cosa que el equipo dormido o congelado.
  private static readonly TICK_MS = 30000;
  private static readonly SILENCE_MS = 150000;
  private static readonly CLOCK_JUMP_MS = 120000;
  private static readonly CONNECTING_TIMEOUT_MS = 20000;

  // Salud de cada servidor de la lista, guardada en userData para que sobreviva a los
  // reinicios: cuando se lo vio por primera vez, cuando conecto por ultima vez y cuantos
  // intentos lleva fallados desde entonces.
  private health: Map<string, ServerHealth> = new Map();
  private lastPurgeAt = 0;
  private checkingServers = false;

  // Cuando se saca de la lista un servidor que nunca contesto. Ver purgeDeadServers().
  private static readonly PURGE_AFTER_MS = 7 * 24 * 3600 * 1000;
  private static readonly PURGE_AFTER_FAILURES = 100;
  private static readonly PURGE_CHECK_MS = 3600000;

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
    // En previsualizacion no: el renderer embebido en la web no es un equipo, no tiene
    // que aparecer conectado ni recibir los mensajes de nadie.
    if (esPreview()) return;
    await this.loadServerHealth();
    setTimeout(() => this.autoConnectToServers(), 2000);
    this.startWatchdog();
  }

  /**
   * Clean up the WebSocket manager
   */
  protected async onCleanup(): Promise<void> {
    this.stopWatchdog();
    
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
    this.lastSeenAt.clear();
    this.health.clear();
    
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
    
    this.connectingServers.set(url, Date.now());
    
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
    
    // Se borran a mano en vez de esperar el onclose: cuando el socket es un zombi
    // —justo el caso que deja al equipo sordo— ese evento no llega nunca, y mientras
    // la entrada siga en el mapa connect() la da por buena y no reconecta.
    this.activeConnections.delete(url);
    if (window.activeConnections) {
      window.activeConnections.delete(url);
    }
    this.connectingServers.delete(url);
    
    this.cleanupConnectionTimers(url);
    this.retryCounts.delete(url);
    
    // Se anota en reconnectTimers y no en un setTimeout suelto: es la unica forma de que
    // ensureEveryServerConnected sepa que este servidor ya tiene un intento en camino y
    // no abra un segundo socket encima.
    this.reconnectTimers.set(
      url,
      setTimeout(() => {
        this.reconnectTimers.delete(url);
        this.connect(url);
      }, 1000)
    );
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
          // Validate that the UUID is a valid WebSocket protocol
          const validatedUUID = this.validateAndSanitizeUUID(uuid, userDataManager);
          return 'uuid-' + validatedUUID;
        }
      }
    } catch (error) {
      console.error('Error getting tokens:', error);
      try {
        const uuid = await userDataManager.getUUID();
        // Validate that the UUID is a valid WebSocket protocol
        const validatedUUID = this.validateAndSanitizeUUID(uuid, userDataManager);
        return 'uuid-' + validatedUUID;
      } catch (uuidError) {
        console.error('Error getting UUID:', uuidError);
        return null;
      }
    }
  }

  private validateAndSanitizeUUID(uuid: string, userDataManager: any): string {
    // CRITICAL FIX: Always trust window.uuid from Electron first
    // If we have a valid window.uuid from Electron, use it without validation
    if (window.uuid && typeof window.uuid === 'string' && window.uuid.trim() !== '') {
      console.log('validateAndSanitizeUUID(): Using trusted window.uuid from Electron:', window.uuid);
      return window.uuid;
    }
    
    // Check if the UUID contains invalid characters for a WebSocket protocol
    // Invalid characters include: space, comma, colon, semicolon, etc.
    // Specifically check for comma which was causing the error
    if (uuid.includes(',') || uuid.includes(' ') || uuid.includes('://')) {
      console.error('CRITICAL: Invalid UUID detected (contains invalid characters):', uuid);
      console.error('This UUID came from:', window.uuid ? 'window.uuid' : 'userDataManager.getUUID()');
      console.error('UUID should only come from Electron main process and be valid.');
      
      // Last resort: clean the UUID by removing invalid characters
      // But DO NOT generate a new UUID - that would break synchronization with Electron
      let cleanedUUID = uuid.replace(/[, :;/]/g, '');
      if (cleanedUUID.length < 36) {
        // If cleaning made it too short, use a fallback
        cleanedUUID = 'invalid-uuid-fallback';
      }
      console.warn('Cleaned invalid UUID for WebSocket protocol:', cleanedUUID);
      return cleanedUUID;
    }
    
    // Also check if it looks like a URL list (contains ws:// or wss://)
    if (uuid.includes('ws://') || uuid.includes('wss://')) {
      console.error('CRITICAL: UUID looks like URL list (should be a UUID):', uuid);
      
      // Extract potential UUID from the string (look for UUID pattern)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = uuid.match(uuidPattern);
      if (match) {
        console.warn('Extracted UUID from URL-like string:', match[0]);
        return match[0];
      }
      
      return 'invalid-uuid-url';
    }
    
    return uuid;
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
      // Cualquier mensaje cuenta como señal de vida, no solo el pong.
      this.lastSeenAt.set(url, Date.now());
      
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
    this.lastSeenAt.set(url, Date.now());
    this.markServerConnected(url);
    
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
        } else {
          // Sin este else el intervalo se queda dando vueltas en vacio para siempre: no
          // manda ping, no arma el pong, no cierra y nadie reconecta. El equipo queda
          // sordo sin escribir una sola linea en el log.
          console.warn(
            'El socket de ' + url + ' ya no esta abierto (readyState ' +
              ws.readyState + '); se reconecta'
          );
          this.forceReconnect(url);
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
    this.markServerFailure(url);
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

    } else if (message.event === 'remove_message') {
      // El mensaje se desactivo en el servidor: si esta puesto se baja, y si esta
      // esperando turno se saca de la cola.
      const retirar = (window as any).retirarMensaje;
      if (typeof retirar === 'function') {
        retirar(String(message.data?.messageId ?? ''));
      }
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
    
    this.lastSeenAt.delete(url);
  }

  // El vigilante: la unica parte que no le cree al socket.
  //
  // Toda la reconexion colgaba de dos hilos que tiene que tirar el propio socket: el
  // evento onclose y el `readyState === OPEN` de su timer de ping. Cuando el equipo se
  // suspende, el sistema se lleva la conexion por delante y el renderer despierta con un
  // socket que ya no sirve y que nunca aviso: onclose no llega, el ping no sale, el pong
  // no se espera y no hay reintento. El cliente sigue vivo, con su ventana abierta, y no
  // recibe un mensaje mas hasta que alguien lo reinicia. En el log de campo eso son dos
  // horas de silencio despues de un hueco de ochenta minutos.
  //
  // Por eso este reloj corre aparte y decide desde afuera: mira cuando se recibio la
  // ultima señal de cada servidor y rehace la conexion aunque el socket jure estar sano.
  private startWatchdog(): void {
    if (this.watchdog) return;
    
    this.lastTickAt = Date.now();
    this.watchdog = setInterval(
      () => this.checkConnections(),
      WebSocketManagerService.TICK_MS
    );
  }

  private stopWatchdog(): void {
    if (!this.watchdog) return;
    
    clearInterval(this.watchdog);
    this.watchdog = null;
  }

  private checkConnections(): void {
    const now = Date.now();
    const drift = now - this.lastTickAt - WebSocketManagerService.TICK_MS;
    this.lastTickAt = now;
    
    // setInterval no corre mientras el equipo duerme: si entre dos vueltas paso mucho mas
    // tiempo del que debia, el equipo estuvo dormido o congelado y ninguna conexion
    // sobrevive a eso. No se revisan una por una, se rehacen todas.
    if (drift > WebSocketManagerService.CLOCK_JUMP_MS) {
      console.warn(
        'El reloj salto ~' + Math.round(drift / 60000) + ' min: el equipo estuvo dormido ' +
          'o congelado; se rehacen todas las conexiones'
      );
      this.reconnectEverything();
      return;
    }
    
    if (now - this.lastPurgeAt > WebSocketManagerService.PURGE_CHECK_MS) {
      this.lastPurgeAt = now;
      this.purgeDeadServers().catch((error) =>
        console.error('Error purging dead servers:', error)
      );
    }
    
    this.connectingServers.forEach((startedAt, url) => {
      if (now - startedAt <= WebSocketManagerService.CONNECTING_TIMEOUT_MS) return;
      
      // La bandera de "conectando" solo se levanta con onopen o con onclose. Un socket
      // que se cuelga al abrir sin ninguno de los dos la deja puesta para siempre, y
      // connect() pasa a ser una funcion que no hace nada por el resto de la sesion.
      console.warn('La conexion a ' + url + ' quedo colgada al abrir; se reintenta');
      this.forceReconnect(url);
    });
    
    this.ensureEveryServerConnected().catch((error) =>
      console.error('Error checking servers are connected:', error)
    );
    
    this.activeConnections.forEach((ws, url) => {
      if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        console.warn('El socket de ' + url + ' esta cerrado y no lo aviso; se reconecta');
        this.forceReconnect(url);
        return;
      }
      
      const lastSeen = this.lastSeenAt.get(url);
      if (ws.readyState !== WebSocket.OPEN || !lastSeen) return;
      
      const silencio = now - lastSeen;
      if (silencio > WebSocketManagerService.SILENCE_MS) {
        console.warn(
          'Sin una sola respuesta de ' + url + ' desde hace ' +
            Math.round(silencio / 1000) + ' s; se reconecta'
        );
        this.forceReconnect(url);
      }
    });
  }

  private async loadServerHealth(): Promise<void> {
    try {
      const userDataManager = serviceRegistry.get<any>('userDataManager');
      const guardada = await userDataManager?.get('serverHealth');
      if (guardada && typeof guardada === 'object') {
        Object.entries(guardada).forEach(([url, datos]) => {
          const salud = datos as Partial<ServerHealth>;
          this.health.set(url, {
            firstSeenAt: Number(salud.firstSeenAt) || Date.now(),
            lastConnectedAt: Number(salud.lastConnectedAt) || null,
            failedAttempts: Number(salud.failedAttempts) || 0,
          });
        });
      }
    } catch (error) {
      // Sin historial se empieza de cero: lo unico que se pierde es la antiguedad, y de
      // paso ningun servidor se purga antes de tiempo.
      console.error('Error loading server health:', error);
    }
  }

  private async saveServerHealth(): Promise<void> {
    try {
      const userDataManager = serviceRegistry.get<any>('userDataManager');
      if (!userDataManager) return;
      
      const plano: Record<string, ServerHealth> = {};
      this.health.forEach((salud, url) => {
        plano[url] = salud;
      });
      await userDataManager.set('serverHealth', plano);
    } catch (error) {
      console.error('Error saving server health:', error);
    }
  }

  private saludDe(url: string): ServerHealth {
    let salud = this.health.get(url);
    if (!salud) {
      salud = { firstSeenAt: Date.now(), lastConnectedAt: null, failedAttempts: 0 };
      this.health.set(url, salud);
    }
    return salud;
  }

  private markServerConnected(url: string): void {
    const salud = this.saludDe(url);
    salud.lastConnectedAt = Date.now();
    salud.failedAttempts = 0;
    this.saveServerHealth();
  }

  private markServerFailure(url: string): void {
    const salud = this.saludDe(url);
    salud.failedAttempts += 1;
    this.saveServerHealth();
  }

  /**
   * Saca de la lista un servidor que nunca contesto.
   *
   * La lista de servidores del equipo es acumulativa: cada alta suma una URL y no hay
   * nada que quite ninguna. Un equipo emparejado alguna vez contra un servidor que ya no
   * existe se queda reintentando contra el fantasma para siempre —en un log de campo son
   * cuatrocientas lineas de error en un dia— y ademas cada vuelta del vigilante lo
   * arrastra consigo.
   *
   * Las tres condiciones son deliberadamente conservadoras, porque esto BORRA
   * configuracion del equipo:
   *
   *   - que no haya conectado NUNCA. Una caida, por larga que sea, deja un
   *     lastConnectedAt y no se toca: un servidor que anduvo puede volver.
   *   - que hayan pasado dias desde que se lo vio por primera vez.
   *   - y que se lo haya intentado de verdad esa cantidad de veces. Sin esto, un equipo
   *     apagado dos semanas volveria y purgaria por almanaque, sin haber probado nada.
   *
   * Nunca el ultimo de la lista: un equipo sin servidores no se arregla solo, hay que ir
   * a emparejarlo de nuevo.
   */
  private async purgeDeadServers(): Promise<void> {
    const userDataManager = serviceRegistry.get<any>('userDataManager');
    if (!userDataManager || typeof userDataManager.getServers !== 'function') return;
    
    const servers: string[] = await userDataManager.getServers();
    if (servers.length <= 1) return;
    
    const ahora = Date.now();
    let quedan = servers.length;
    
    for (const url of servers) {
      if (quedan <= 1) break;
      
      const salud = this.health.get(url);
      if (!salud || salud.lastConnectedAt) continue;
      
      const antiguedad = ahora - salud.firstSeenAt;
      if (antiguedad < WebSocketManagerService.PURGE_AFTER_MS) continue;
      if (salud.failedAttempts < WebSocketManagerService.PURGE_AFTER_FAILURES) continue;
      
      console.warn(
        'Se saca de la lista ' + url + ': nunca contesto en ' +
          Math.round(antiguedad / 86400000) + ' dias y ' + salud.failedAttempts +
          ' intentos'
      );
      
      await userDataManager.removeServer(url);
      this.health.delete(url);
      quedan -= 1;
      
      // Se cierra lo que quede colgando de esa URL. Los reintentos se cortan solos:
      // scheduleReconnection comprueba contra la lista antes de volver a marcar.
      const ws = this.activeConnections.get(url);
      if (ws) ws.close();
      this.activeConnections.delete(url);
      if (window.activeConnections) {
        window.activeConnections.delete(url);
      }
      this.connectingServers.delete(url);
      this.cleanupConnectionTimers(url);
      this.retryCounts.delete(url);
    }
    
    await this.saveServerHealth();
  }

  /**
   * Que todo servidor de la lista tenga conexion, o al menos un intento en camino.
   *
   * El resto del vigilante mira los mapas en memoria, y por eso no vio la unica caida que
   * de verdad paso en produccion: al reiniciarse la API el socket se cerro LIMPIO,
   * handleConnectionClose lo saco de activeConnections y de connectingServers, y dejo el
   * reintento en manos de scheduleReconnection. Cuando ese reintento se pierde —su
   * consulta de la lista devuelve vacio, o el connect() que programo se va por la guarda
   * de connectingServers— no queda NADA en los mapas: cero conexiones, cero intentos, y
   * un vigilante que recorre dos mapas vacios y no encuentra trabajo. El equipo estuvo
   * cuatro minutos sin conexion y sin una sola linea en el log, hasta que alguien abrio
   * el menu y leyo "No active connections available".
   *
   * La lista de servidores es la unica fuente que no se vacia sola. Se parte de ahi.
   */
  private async ensureEveryServerConnected(): Promise<void> {
    if (this.checkingServers) return;
    this.checkingServers = true;
    
    try {
      const userDataManager = serviceRegistry.get<any>('userDataManager');
      if (!userDataManager || typeof userDataManager.getServers !== 'function') return;
      
      const servers: string[] = await userDataManager.getServers();
      for (const url of servers) {
        const readyState = this.activeConnections.get(url)?.readyState;
        if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) continue;
        
        // Estos dos ya tienen quien los mire: la conexion colgada la destraba el chequeo
        // de los 20 s, y el reintento programado tiene su propio reloj.
        if (this.connectingServers.has(url)) continue;
        if (this.reconnectTimers.has(url)) continue;
        
        console.warn(
          'El servidor ' + url + ' no tiene conexion ni reintento en camino; se levanta'
        );
        this.connect(url);
      }
    } finally {
      this.checkingServers = false;
    }
  }

  private async reconnectEverything(): Promise<void> {
    const urls = new Set<string>(this.activeConnections.keys());
    this.connectingServers.forEach((_startedAt, url) => urls.add(url));
    
    // El vigilante no puede quedarse quieto porque falle una consulta: si la lista de
    // servidores no se puede leer, igual se rehacen las conexiones que ya se conocen.
    try {
      const userDataManager = serviceRegistry.get<any>('userDataManager');
      if (userDataManager && typeof userDataManager.getServers === 'function') {
        const servers = await userDataManager.getServers();
        servers.forEach((url: string) => urls.add(url));
      }
    } catch (error) {
      console.error('Error getting servers for reconnection:', error);
    }
    
    urls.forEach((url) => this.forceReconnect(url));
  }

  private async scheduleReconnection(url: string, _event: CloseEvent): Promise<void> {
    // Get userDataManager from service registry
    const userDataManager = serviceRegistry.get<any>('userDataManager');
    
    if (userDataManager && typeof userDataManager.getServers === 'function') {
      try {
        const servers = await userDataManager.getServers();
        // El `servers.length` no sobra: si la consulta devuelve vacio —el IPC que falla,
        // el archivo que todavia no se leyo— esto daba por borrado un servidor que sigue
        // en la config, y abandonaba el reintento en silencio y para siempre. Solo se
        // abandona cuando la lista se pudo leer Y el servidor no esta en ella.
        if (servers.length && !servers.includes(url)) {
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
              if (servers.length && !servers.includes(url)) {
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
            if (servers.length && !servers.includes(url)) {
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