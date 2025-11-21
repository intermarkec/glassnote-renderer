import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// Import and initialize global utilities
import './utils/compatibility'
import './utils/global'
import './config/global-config'

// Import core systems
import './systems/app-init'
import './systems/websocket-manager-complete'

// Import glass system modules first to ensure Glass class is available
import './systems/glass/index'

// Import additional modules
import './systems/user-data-manager'
import './systems/config-menu'
import './systems/glass/html-processor'
import './systems/glass/svg-processor'
import './systems/glass/image-processor'
import './systems/glass/confirmation-button'

// Import dom-events last to ensure all dependencies are loaded
import './systems/dom-events'

console.log('Glass system modules loaded and available globally')

const app = createApp(App)

// Make global systems available to Vue components
app.config.globalProperties.$config = window.config
app.config.globalProperties.$websocketManager = window.websocketManager
app.config.globalProperties.$glassSystem = window.glassSystem

console.log('Vue app created, mounting to #app')

app.mount('#app')

console.log('Vue app mounted successfully')