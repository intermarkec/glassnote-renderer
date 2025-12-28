import { GlassData } from '../utils/global'

// Screen event handling for Android WebView communication
window.handleScreenEvent = function(event: string): void {
  processScreenEvent(event)
}

// Listen for custom screen events
window.addEventListener('screen-event', function(e: Event) {
  const customEvent = e as CustomEvent
  processScreenEvent(customEvent.detail.event)
})

// AndroidBridge compatibility (if available)
if (typeof window.AndroidBridge !== 'undefined' && typeof window.AndroidBridge.postMessage === 'function') {
  // Store original postMessage for fallback
  const originalPostMessage = window.AndroidBridge.postMessage
  
  window.AndroidBridge.postMessage = function(message: string): void {
    try {
      const parsed = JSON.parse(message)
      if (parsed.type === 'screen_event' && parsed.event) {
        processScreenEvent(parsed.event)
        return
      }
    } catch (e) {
      // Not a screen event, pass through to original
    }
    originalPostMessage.call(window.AndroidBridge, message)
  }
}

function processScreenEvent(event: string): void {
  // Handle screen availability events
  if (event === 'screen is available') {
    window.is_screen_available = true
  }
  else if (event === 'screen is not available') {
    window.is_screen_available = false
  }
}

// Function to add glass to unified queue
function addToUnifiedQueue(url: string | null, message: any): void {
  // NO verificar duplicados aquí - ya se verificó en websocket-manager
  // Solo agregar a la cola directamente

  if (message.data.needPresent === true) {
    window.is_user_present = false

    try {
      // Use centralized passthrough manager if available
      if (window.passthroughManager) {
        window.passthroughManager.setPassthrough(false);
      } else if (window.AndroidBridge) {
        // Fallback to direct AndroidBridge
        window.AndroidBridge.setIgnoreEventsFalse()
      }
    } catch (e) {
      console.error('Error setting ignore events to true: ' + e)
    }
  }
  
  window.unifiedGlassQueue.push({
    url: url,
    message: message,
    timestamp: Date.now()
  })
  
  // Reproducir sonido de cola cuando se agrega un mensaje a la cola (siempre)
  if (typeof window.playQueueSound === 'function') {
    window.playQueueSound()
  }
 
  // Show window to allow presence detection
  if (window.checkWindowVisibility) {
    window.checkWindowVisibility()
  }
}

// Function to remove glass from unified queue when it finishes displaying
function removeFromUnifiedQueue(messageId: string): void {
  if (!window.unifiedGlassQueue || !messageId) {
    return
  }
  
  const index = window.unifiedGlassQueue.findIndex(function(item: GlassData) {
    return item.message.data.messageId === messageId
  })
  
  if (index !== -1) {
    window.unifiedGlassQueue.splice(index, 1)
  }
}

// Function to check if glass can be displayed
function canDisplayGlass(glassData: GlassData): boolean {
  const data = glassData.message.data
  // Condition 1: Screen must be available
  if (!window.is_screen_available) {
    return false
  }
  
  // Condition 2: If needPresent is true, user must be present
  if (data.needPresent === true && !window.is_user_present) {
    // Set user presence to false to ensure window visibility
    window.is_user_present = false
    if (window.checkWindowVisibility) {
      window.checkWindowVisibility()
    }
    return false
  }
    
  // Condition 3: Position must be available (for non-async messages)
  // Esta verificación se hace aquí en la cola unificada, glass.js solo maneja activeGlasses
  if (data.isAsyncronous !== true) {
    try {
      const position = JSON.parse(data.position)
      const positionKey = position.h + ':' + position.v
      
      if (window.activeGlasses && window.activeGlasses.has(positionKey)) {
        return false
      }
    } catch (e) {
      console.error('Error parsing position for glass ' + data.id + ': ' + e)
      return false
    }
  }
  
  return true
}

// Function to process unified queue
function processUnifiedQueue(): void {
  if (window.unifiedGlassQueue.length === 0) {
    return
  }
  
  // Set flag to indicate we're processing the queue
  isProcessingUnifiedQueue = true
  
  // Create a copy to avoid modification during iteration
  const queueCopy = window.unifiedGlassQueue.slice()
  let processedAny = false
  
  for (let i = 0; i < queueCopy.length; i++) {
    const glassData = queueCopy[i]
    
    if (canDisplayGlass(glassData)) {
      // Remover de la cola antes de procesar para evitar loops infinitos
      const messageId = glassData.message.data.messageId
      removeFromUnifiedQueue(messageId)
      
      // Use original constructor to display (bypass unified queue)
      new originalGlassConstructor(glassData.url, glassData.message)
      processedAny = true
      
      // Break after processing one to avoid multiple glasses at once
      break
    }
  }
  
  // Clear processing flag
  isProcessingUnifiedQueue = false

  if (processedAny && window.unifiedGlassQueue.length > 0) {
    console.log('Continuing queue processing in next cycle')
  }
  
  // Update window visibility after processing queue
  if (window.checkWindowVisibility) {
    window.checkWindowVisibility()
  }
}

// Make removeFromUnifiedQueue globally available
window.removeFromUnifiedQueue = removeFromUnifiedQueue

// Modify Glass constructor to use unified queue for new glasses only
const originalGlassConstructor = window.Glass
let isProcessingUnifiedQueue = false

window.Glass = function(url: string | null, message: any): void {
  // Si estamos procesando la cola unificada, usar el constructor original
  if (isProcessingUnifiedQueue) {
    return new originalGlassConstructor(url, message)
  }
  
  // Para glasses nuevos, agregar a la cola unificada
  addToUnifiedQueue(url, message)
  
  // No procesar inmediatamente - el procesamiento periódico se encargará
  // Esto evita que mensajes con needPresent se muestren inmediatamente si is_user_present es true por defecto
}

// Start periodic queue processing
setInterval(function() {
  processUnifiedQueue()
}, 1000) // Process every second

// Cargar versión del renderer al inicio
// Note: FileLoader will be implemented in the glass system
if (typeof (window as any).FileLoader !== 'undefined') {
  (window as any).FileLoader.loadPackageVersion()
    .then(function(rendererVersion: string) {
      window.rendererVersion = rendererVersion
    })
    .catch(function(error: any) {
      console.warn('Failed to load renderer version:', error)
      window.rendererVersion = 'TEMPORAL'
    })
}

// Add testButton event logging and other DOM events
document.addEventListener('DOMContentLoaded', function() {
  const detectPresenceHandler = function() {
    window.is_user_present = true
    const configMenuVisible = window._configMenuInstance && window._configMenuInstance.isVisible
    if (window.activeConfirmationGlasses === 0 && !configMenuVisible) {
      //SE QUITA TOUCH CUANDO NO HAY GLASSES QUE REQUIERAN CONFIRMACION
      // Use centralized passthrough manager if available
      if (window.passthroughManager) {
        window.passthroughManager.setPassthrough(true);
      } else if (window.AndroidBridge) {
        // Fallback to direct AndroidBridge
        window.AndroidBridge.setIgnoreEventsTrue()
      }
    }
    // Process queue when user becomes present
    processUnifiedQueue()
  }

  // Add mouse move event listener to body (for presence detection)
  document.body.addEventListener('mousemove', detectPresenceHandler)
  document.body.addEventListener('pointerdown', detectPresenceHandler)

  // Function to load splash HTML template
  function loadSplashTemplate(): Promise<string> {
    return fetch('./splash.html')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load splash template')
        }
        return response.text()
      })
      .catch(error => {
        console.error('Error loading splash template:', error)
        // Fallback to inline template
        return `<div
  style="width: 450px; height: 450px; background: linear-gradient(135deg, rgb(76, 45, 85) 0%, rgb(76, 29, 122) 100%); border-radius: 5%; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: Arial, sans-serif; box-shadow: rgba(0, 0, 0, 0.3) 0px 10px 30px; font-size: 100px;" >
  
  <img src="./logo.svg" style="width: 40%; height: auto; margin: 3%;" alt="Splash">

  <p style="font-size: 0.3em; margin: 0;">%VERSION%</p>
  <div
      style="margin-top: 5%; width: 45%; height: 45%; background: rgba(253, 240, 240, 1); border-radius: 50%; display: flex; justify-content: center; align-items: center; animation: pulse 2s infinite;">
      <img src="./imago.svg" style="width: 60%; height: auto;" alt="Splash">
  </div>
</div>
<style> @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } } </style>`
      })
  }

  // Global function to show splash
  window.showSplash = function(): void {
    console.log('showSplash function called')
    loadSplashTemplate().then((template) => {
      console.log('Splash template loaded successfully')
      const glassConfig = {
        event: 'message',
        data: {
          id: 6635,
          messageId: 'preview-6635', // Add messageId for duplicate detection
          type: 'PREVIEW',
          uploads: '[{"id":"3ad42722-742a-442a-af8d-429f638bbf00","path":"splash.svg","mimetype":"image/svg+xml"}]',
          position: '{"h":1,"v":1}',
          duration: 5,
          transparency: '0.80',
          isUserDevice: false,
          needPresent: false,
          askConfirmation: false,
          isAsyncronous: false,
          baseUrl: './',
          parameters: JSON.stringify([{"label":"html","value":template}]),
          messageType: 'html',
        },
      }

      console.log('Creating glass with config:', glassConfig)

      // Create glass with the configuration using the modified Glass constructor
      // This ensures preview messages go through the unified queue and duplicate detection
      // Use null for URL since this is a local preview
      if (window.Glass) {
        console.log('Glass constructor available, creating glass')
        new window.Glass(null, glassConfig)
        console.log('Glass created successfully')
      } else {
        console.error('Glass constructor not available')
      }
    }).catch((error) => {
      console.error('Failed to load splash template:', error)
    })
  }

  // Show splash immediately on DOM ready (for backward compatibility)
  setTimeout(() => {
    if (window.showSplash) {
      window.showSplash()
    }
  }, 100)
  
  const testButton = document.getElementById('testButton')
  if (testButton) {
    // Toggle clickthrough on mouseover/out
    testButton.addEventListener('mouseover', function() {
      try {
        // Use centralized passthrough manager if available
        if (window.passthroughManager) {
          window.passthroughManager.setPassthrough(false);
        } else if (window.electronAPI) {
          // Fallback to direct electron API
          window.electronAPI.send('set-ignore-events-false')
        }
      } catch (e) {
        console.error('Not in Electron environment, using CSS fallback')
      }
    })

    testButton.addEventListener('mouseout', function() {
      try {
        // Use centralized passthrough manager if available
        if (window.passthroughManager) {
          window.passthroughManager.setPassthrough(true);
        } else if (window.electronAPI) {
          // Fallback to direct electron API
          window.electronAPI.send('set-ignore-events-true')
        }
      } catch (e) {
        console.error('Not in Electron environment, using CSS fallback')
      }
    })

    // Keep other event logging
    const events = [
      'click',
      'dblclick',
      'mousedown',
      'mouseup',
      'mouseover',
      'mouseout',
      //'mousemove',
      'focus',
      'blur',
      'keydown',
      'keyup',
    ]
    
    for (let i = 0; i < events.length; i++) {
      (function(eventName) {
        testButton.addEventListener(eventName, function(e: Event) {
          // Event handling can be added here if needed
        })
      })(events[i])
    }
  }

  // Register button is now in config menu, no need for event handlers here

  // Initialize ConfigMenu after DOM is ready (solo si no existe ya una instancia)
  if (typeof window.ConfigMenu === 'function' && !window._configMenuInstance) {
    window._configMenuInstance = new window.ConfigMenu()
  } else if (window._configMenuInstance) {
    // Config menu already exists
  } else {
    console.error('ConfigMenu class not available')
  }

  // Initialize Electron handlers after everything is ready
  if (typeof window.initializeElectronHandlers === 'function') {
    window.initializeElectronHandlers()
  }
})

// Global function to show config menu
window.showConfigMenu = function(): void {
  if (window._configMenuInstance && typeof window._configMenuInstance.show === 'function') {
    window._configMenuInstance.show()
  } else {
    console.error('ConfigMenu instance not available or show method not found')
  }
}