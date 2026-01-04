import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// Import service infrastructure
import { serviceRegistry } from './services/registry'
import { WebSocketManagerService } from './services/websocket-manager-service'
import { UserDataManagerService } from './services/user-data-manager-service'
import { SoundSystemService } from './services/sound-system-service'
import { WindowVisibilityService } from './services/window-visibility-service'
import { PassthroughService } from './services/passthrough-service'

// Import and initialize global utilities (temporary during migration)
import './utils/compatibility'
import './utils/global'
import './config/global-config'

// Import core systems (temporary during migration)
import './systems/app-init'

// Import glass system modules first to ensure Glass class is available
import './systems/glass/index'

// Import additional modules (temporary during migration)
import './systems/user-data-manager'
import './systems/config-menu'
import './systems/glass/html-processor'
import './systems/glass/svg-processor'
import './systems/glass/image-processor'
import './systems/glass/confirmation-button'

// Import registration system
import { setupRegistrationSystem } from './systems/registration-system'

// Import dom-events last to ensure all dependencies are loaded
import './systems/dom-events'

console.log('Glass system modules loaded and available globally')

// Setup registration system
setupRegistrationSystem()

// Initialize service registry with services
const websocketManagerService = new WebSocketManagerService()
const userDataManagerService = new UserDataManagerService()
const soundSystemService = new SoundSystemService()
const windowVisibilityService = new WindowVisibilityService()
const passthroughService = PassthroughService.getInstance()

serviceRegistry.register('websocketManager', websocketManagerService)
serviceRegistry.register('userDataManager', userDataManagerService)
serviceRegistry.register('soundSystem', soundSystemService)
serviceRegistry.register('windowVisibility', windowVisibilityService)
serviceRegistry.register('passthrough', passthroughService)

// TODO: Register other services as they are implemented
// serviceRegistry.register('glassSystem', new GlassSystemService())
// serviceRegistry.register('electronBridge', new ElectronBridgeService())
// serviceRegistry.register('configMenu', new ConfigMenuService())
// serviceRegistry.register('appInit', new AppInitService())
// serviceRegistry.register('domEvents', new DomEventsService())

// Make service registry available globally for backward compatibility during migration
;(window as any).serviceRegistry = serviceRegistry

const app = createApp(App)

// Make service registry available to Vue components
app.provide('serviceRegistry', serviceRegistry)

// Legacy global properties for backward compatibility during migration
app.config.globalProperties.$config = window.config
app.config.globalProperties.$websocketManager = window.websocketManager
app.config.globalProperties.$glassSystem = window.glassSystem

console.log('Vue app created, mounting to #app')

app.mount('#app')

console.log('Vue app mounted successfully')

// Initialize services after mount
serviceRegistry.initializeAll().then(() => {
  console.log('All services initialized successfully')
}).catch(error => {
  console.error('Failed to initialize services:', error)
})