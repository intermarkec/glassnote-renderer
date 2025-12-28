// Application initialization system

// Try to get UUID from URL first using utility function
const uuidFromURL = window.getURLParameter ? window.getURLParameter('uuid') : null
if (uuidFromURL) {
  window.uuid = uuidFromURL
}

// Initialize Electron API if available
if (window.electronAPI) {
  window.electronAPI.receive('app-data', function(data: any) {
    window.appVersion = data.version
  })

  // Receive servers list - just log it but don't connect automatically
  window.electronAPI.receive('servers-list', function(servers: string[]) {
    window.servers = servers // Keep for backward compatibility
    // DO NOT connect automatically - let user-data-manager handle the connections
  })
} else {
  // Use centralized platform detection to determine correct version
  // Check if platform detection functions are available
  if (window.getPlatformContext) {
    const platform = window.getPlatformContext();
    if (platform === 'android') {
      window.appVersion = 'MOVIL';
    } else if (platform === 'browser') {
      window.appVersion = 'BROWSER';
    } else {
      window.appVersion = 'MOVIL'; // Fallback
    }
  } else {
    // Fallback to old logic
    window.appVersion = 'MOVIL'
  }
  
  // Load servers using centralized user data manager
  if (window.userDataManager) {
    window.userDataManager.getServers().then(function(servers: string[]) {
      window.servers = servers // Keep for backward compatibility
      // DO NOT connect automatically - connections will be handled by user-data-manager
    }).catch(function(error: any) {
      console.error('Error loading servers: ' + error)
      window.servers = []
    })
  } else {
    window.servers = []
  }
}

// Add keyboard event listener
window.addEventListener('keydown', function() {
  // Keyboard event handling can be added here if needed
})

// Initialize heartbeat and connection monitoring systems
setTimeout(function() {
  // Start network monitoring if available
  if (window.startNetworkMonitoring) {
    window.startNetworkMonitoring()
  }
  
  // Start connection health monitoring if available
  if (window.startConnectionHealthMonitoring) {
    window.startConnectionHealthMonitoring()
  }
  
  // Start WebSocket health monitoring if available
  if (window.startWebSocketHealthMonitoring) {
    window.startWebSocketHealthMonitoring()
  }
  
  console.log('Heartbeat and connection monitoring systems initialized')
}, 5000) // Start after 5 seconds to ensure everything is loaded

// Export app initialization function
export function appInit(): void {
  console.log('Glassnote renderer initialized')
}

// Make appInit globally available
window.appInit = appInit