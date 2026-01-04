export {}

declare global {
  interface Window {
    // Platform detection (essential for platform-specific code)
    AndroidBridge?: {
      postMessage: (message: string) => void
      setIgnoreEventsTrue: () => void
      setIgnoreEventsFalse: () => void
      openExternal?: (url: string) => void
    }

    // Legacy compatibility during migration (marked as optional)
    // These will be removed after full migration
    connectWebSocket?: (url: string) => Promise<void>
    getConnectionStatus?: (url: string) => any
    getAllConnectionsStatus?: () => any
    forceReconnect?: (url: string) => void
    handleNetworkRestored?: () => void
    Glass?: any
    playGlassSound?: () => void
    playQueueSound?: () => void
    userDataManager?: any
    electronAPI?: any
    websocketManager?: any
    glassSystem?: any
    
    // Essential state that may remain temporarily
    config?: any
    appVersion?: string
    uuid?: string
    userStatus?: string
    is_screen_available?: boolean
    is_user_present?: boolean
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

    // Utility functions that may be used before services are initialized
    getURLParameter: (name: string) => string | null
    getPlatformContext: () => 'android' | 'electron' | 'browser'
    isBrowserMode: () => boolean
    isElectronMode: () => boolean
    isAndroidMode: () => boolean

    // Properties used in dom-events.ts and other files
    handleScreenEvent?: (event: string) => void
    removeFromUnifiedQueue?: (messageId: string) => void
    rendererVersion?: string
    showSplash?: () => void
    _configMenuInstance?: any
    ConfigMenu?: any
    toggleConfigMenu?: (view?: string) => void
    showConfigMenu?: () => void
    initializeElectronHandlers?: () => void
    passthroughManager?: {
      setPassthrough: (ignore: boolean) => void
    }
    checkWindowVisibility?: () => void

    // Additional properties found in TypeScript errors
    startNetworkMonitoring?: () => void
    startConnectionHealthMonitoring?: () => void
    startWebSocketHealthMonitoring?: () => void
    appInit?: () => void
    _handleWebSocketMessage?: (url: string, event: MessageEvent) => Promise<void>
    _originalHandleWebSocketMessage?: (url: string, event: MessageEvent) => Promise<void>
    requestRegistrationCode?: () => void
    closeRegistrationConnection?: () => void
    handleRegisterButtonClick?: () => void
    positionRegisterButtonBelowKeycode?: () => void
    FileLoader?: any
    PositionManager?: any
    ScaleCalculator?: any
    HTMLProcessor?: any
    SVGProcessor?: any
    ImageProcessor?: any
    ConfirmationButton?: any
    audioInstances?: Record<string, HTMLAudioElement>
    playSound?: (soundType: string) => void
    stopSound?: (soundType: string) => void
    getActiveGlassesStatus?: () => any
    cleanupGhostGlasses?: () => number
    isDuplicateMessage?: (messageId: string, position: string) => boolean
    compatibilityLoaded?: boolean
    
    // Registration system properties
    REGISTRATION_SERVER_URL?: string
    generateUUID?: () => string
    setKeycodeText?: (text: string) => void
  }
}