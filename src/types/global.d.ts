export {}

declare global {
  interface Window {
    // Global configuration
    config: any
    appVersion: string
    uuid: string
    userStatus: string
    is_screen_available: boolean
    is_user_present: boolean
    activeConnections: Map<string, WebSocket>
    reconnectTimers: Map<string, NodeJS.Timeout>
    pingTimers: Map<string, NodeJS.Timeout>
    pongTimers: Map<string, NodeJS.Timeout>
    retryCounts: Map<string, number>
    activeGlasses: Map<string, any>
    registrationRetryCounts: Map<string, number>
    unifiedGlassQueue: Array<any>
    activeConfirmationGlasses: number
    isWindowVisible: boolean
    registrationProxyActive: boolean
    servers: string[]
    certificateFailures: Map<string, number>
    connectingServers: Map<string, boolean>
    
    // Global functions
    appInit: () => void
    setKeycodeText: (text: string) => void
    getURLParameter: (name: string) => string | null
    handleScreenEvent: (event: string) => void
    showConfigMenu: () => void
    removeFromUnifiedQueue: (messageId: string) => void
    connectWebSocket: (url: string) => Promise<void>
    getConnectionStatus: (url: string) => any
    getAllConnectionsStatus: () => any
    forceReconnect: (url: string) => void
    handleNetworkRestored: () => void
    
    // WebSocket manager
    websocketManager: any
    
    // Glass system
    glassSystem: any
    Glass: any
    
    // Electron API
    electronAPI?: {
      receive: (channel: string, callback: (data: any) => void) => void
      send: (channel: string, data?: any) => void
      getUserData: (key: string, nestedKey?: string) => Promise<any>
      setUserData: (key: string, nestedKey?: string, value?: any) => Promise<void>
      removeUserData: (key: string, nestedKey?: string) => Promise<void>
    }
    
    // Android Bridge
    AndroidBridge?: {
      postMessage: (message: string) => void
      setIgnoreEventsTrue: () => void
      setIgnoreEventsFalse: () => void
    }
    
    // User data manager
    userDataManager?: {
      getServers: () => Promise<string[]>
      getUUID: () => Promise<string>
      getAccessTokens: () => Promise<Record<string, string>>
      getRefreshTokens: () => Promise<Record<string, string>>
      getRefreshTokenHash: (url: string) => Promise<string | null>
      setAccessToken: (url: string, token: string) => Promise<boolean>
      setRefreshToken: (url: string, token: string) => Promise<boolean>
      setRefreshTokenHash: (url: string, hash: string) => Promise<boolean>
      removeAccessToken: (url: string) => Promise<boolean>
      removeRefreshToken: (url: string) => Promise<boolean>
      removeServer: (url: string) => Promise<boolean>
      get: (key: string, nestedKey?: string) => Promise<any>
      set: (key: string, nestedKey: string | any, value?: any) => Promise<boolean>
      remove: (key: string, nestedKey?: string) => Promise<boolean>
      addServer: (serverUrl: string) => Promise<boolean>
      handleRegistrationResponse: (serverUrl: string, refreshToken: string, refreshTokenHash?: string) => Promise<boolean>
    }
    
    // Config menu
    _configMenuInstance?: any
    ConfigMenu?: any
    
    // Compatibility
    compatibilityLoaded?: boolean
    
    // Sound functions
    playQueueSound?: () => void
    
    // Window visibility
    checkWindowVisibility?: () => void
    
    // Network monitoring
    startNetworkMonitoring?: () => void
    startConnectionHealthMonitoring?: () => void
    startWebSocketHealthMonitoring?: () => void
    
    // Duplicate message detection
    isDuplicateMessage?: (messageId: string, position: string) => boolean
    
    // Renderer version
    rendererVersion?: string
    
    // Electron handlers
    initializeElectronHandlers?: () => void
    
    // Glass system
    Glass?: any
    FileLoader?: any
    PositionManager?: any
    ScaleCalculator?: any
    HTMLProcessor?: any
    SVGProcessor?: any
    ImageProcessor?: any
    ConfirmationButton?: any
    
    // Sound system
    audioInstances?: Record<string, HTMLAudioElement>
    playSound?: (soundType: string) => void
    stopSound?: (soundType: string) => void
    playGlassSound?: () => void
    playQueueSound?: () => void
    
    // Glass utilities
    getActiveGlassesStatus?: () => any
    cleanupGhostGlasses?: () => number
  }
}