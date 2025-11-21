// Glass sound system

interface AudioInstances {
  [key: string]: HTMLAudioElement
}

declare global {
  interface Window {
    audioInstances?: AudioInstances
  }
}

// Global audio instances for control
window.audioInstances = window.audioInstances || {}

/**
 * Reproduce sonidos según el contexto y dispositivo
 */
export function playSound(soundType: string): void {
  try {
    let soundFile: string
    const volume = 0.5
    
    // Determinar qué archivo de sonido usar
    if (typeof window.AndroidBridge !== 'undefined') {
      // Android con AndroidBridge
      soundFile = soundType === 'glass' ? './sound/glasscell.wav' : './sound/queuecell.wav'
    } else {
      // Desktop u otros dispositivos
      soundFile = soundType === 'glass' ? './sound/glass.wav' : './sound/queue.wav'
    }
    
    // Detener sonido anterior del mismo tipo si existe
    if (window.audioInstances && window.audioInstances[soundType]) {
      try {
        window.audioInstances[soundType].pause()
        window.audioInstances[soundType].currentTime = 0
      } catch (e) {
        console.error('Error stopping previous ' + soundType + ' sound:', e)
      }
    }
    
    const audio = new Audio(soundFile)
    audio.volume = volume
    if (window.audioInstances) {
      window.audioInstances[soundType] = audio
    }
    
    audio.play().catch(function(error) {
      // Ignore playback errors
    })
  } catch (error) {
    console.error('Could not play ' + soundType + ' sound:', error)
  }
}

/**
 * Detiene un sonido específico
 */
export function stopSound(soundType: string): void {
  try {
    if (window.audioInstances && window.audioInstances[soundType]) {
      window.audioInstances[soundType].pause()
      window.audioInstances[soundType].currentTime = 0
    }
  } catch (error) {
    console.error('Error stopping ' + soundType + ' sound:', error)
  }
}

/**
 * Reproduce el sonido glass.wav cuando se muestra un glass
 */
export function playGlassSound(): void {
  playSound('glass')
}

/**
 * Reproduce el sonido queue.wav cuando un mensaje entra en cola
 */
export function playQueueSound(): void {
  playSound('queue')
}

// Make functions globally available
window.playSound = playSound
window.playGlassSound = playGlassSound
window.playQueueSound = playQueueSound
window.stopSound = stopSound