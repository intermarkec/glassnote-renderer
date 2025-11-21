// Global configuration and state variables with strong typing

// Global Maps for tracking connections and timers
window.activeConnections = new Map<string, WebSocket>()
window.reconnectTimers = new Map<string, NodeJS.Timeout>()
window.pingTimers = new Map<string, NodeJS.Timeout>()
window.pongTimers = new Map<string, NodeJS.Timeout>()
window.retryCounts = new Map<string, number>()
window.activeGlasses = new Map<string, any>()
window.registrationRetryCounts = new Map<string, number>()
window.unifiedGlassQueue = []
window.activeConfirmationGlasses = 0

// Webview state
window.isWindowVisible = false

// Registration proxy state
window.registrationProxyActive = false

// Initialize other global variables
window.appVersion = ''
window.uuid = ''
window.userStatus = 'active'
window.is_screen_available = true
window.is_user_present = false
window.servers = []

// Certificate failures (kept for compatibility but not used)
window.certificateFailures = new Map<string, number>()

// Connecting servers tracking
window.connectingServers = new Map<string, boolean>()

// Make globals available for other modules
export const globalConfig = {
  appVersion: window.appVersion,
  uuid: window.uuid,
  userStatus: window.userStatus,
  is_screen_available: window.is_screen_available,
  is_user_present: window.is_user_present,
  activeConnections: window.activeConnections,
  reconnectTimers: window.reconnectTimers,
  pingTimers: window.pingTimers,
  pongTimers: window.pongTimers,
  retryCounts: window.retryCounts,
  activeGlasses: window.activeGlasses,
  registrationRetryCounts: window.registrationRetryCounts,
  unifiedGlassQueue: window.unifiedGlassQueue,
  isWindowVisible: window.isWindowVisible,
  registrationProxyActive: window.registrationProxyActive,
  activeConfirmationGlasses: window.activeConfirmationGlasses,
  certificateFailures: window.certificateFailures,
  connectingServers: window.connectingServers,
  servers: window.servers
}

// Export for use in other modules
export default globalConfig