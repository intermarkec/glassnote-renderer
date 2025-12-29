// Application initialization system

// Try to get UUID from URL first using utility function
const uuidFromURL = window.getURLParameter ? window.getURLParameter('uuid') : null
if (uuidFromURL) {
  window.uuid = uuidFromURL
}

// Try to get version from URL query parameter (primary source for Electron version)
console.log('URL search:', window.location.search)
const versionFromURL = window.getURLParameter ? window.getURLParameter('version') : null
console.log('Version from URL parameter:', versionFromURL)

if (versionFromURL) {
  window.appVersion = versionFromURL
  console.log('App version from URL parameter:', window.appVersion)
} else {
  // No version in URL - fallback based on platform
  if (window.electronAPI) {
    // In Electron but no version parameter - use empty string (will show as empty in splash)
    window.appVersion = ''
    console.warn('No version parameter in URL, using empty string for Electron version')
  } else if (window.getPlatformContext) {
    const platform = window.getPlatformContext();
    if (platform === 'android') {
      window.appVersion = 'MOVIL';
    } else if (platform === 'browser') {
      window.appVersion = 'BROWSER';
    } else {
      window.appVersion = 'MOVIL'; // Fallback
    }
  } else {
    window.appVersion = 'MOVIL'
  }
}

// Initialize Electron API if available (for other purposes like servers list)
if (window.electronAPI) {
  // Receive servers list - just log it but don't connect automatically
  window.electronAPI.receive('servers-list', function(servers: string[]) {
    window.servers = servers // Keep for backward compatibility
    // DO NOT connect automatically - let user-data-manager handle the connections
  })
  
  // Optionally still listen to app-data for backward compatibility, but ignore if we already have version
  window.electronAPI.receive('app-data', function(data: any) {
    console.log('App data received (backup):', JSON.stringify(data))
    // Only update if appVersion is still empty
    if (!window.appVersion && data.version) {
      window.appVersion = data.version
      console.log('App version updated from IPC backup:', window.appVersion)
    }
  })
} else {
  // Not in Electron - load servers using centralized user data manager
  if (window.userDataManager) {
    window.userDataManager.getServers().then(function(servers: string[]) {
      window.servers = servers // Keep for backward compatibility
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