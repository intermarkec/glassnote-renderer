// Glass system main entry point - imports all modules and makes them globally available

import { Glass, FileLoader } from '../glass-system'
import { PositionManager } from './position-manager'
import { playSound, stopSound, playGlassSound, playQueueSound } from './sound-system'

// Import and make available globally
window.Glass = Glass
window.FileLoader = FileLoader
window.PositionManager = PositionManager
window.playSound = playSound
window.stopSound = stopSound
window.playGlassSound = playGlassSound
window.playQueueSound = playQueueSound

// Export all modules for use in other parts of the application
export { Glass, FileLoader, PositionManager }
export { playSound, stopSound, playGlassSound, playQueueSound } from './sound-system'
export * from './types'

console.log('Glass system modules loaded and available globally')