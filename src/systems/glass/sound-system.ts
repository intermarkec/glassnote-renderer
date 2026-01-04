// Glass sound system - Service wrapper
import { serviceRegistry } from '../../services/registry';

/**
 * Reproduce sonidos según el contexto y dispositivo
 * This function delegates to the SoundSystemService
 */
export function playSound(soundType: string): void {
  const soundSystem = serviceRegistry.get<any>('soundSystem');
  if (soundSystem && typeof soundSystem.playSound === 'function') {
    soundSystem.playSound(soundType);
  } else {
    console.error('SoundSystemService not available');
  }
}

/**
 * Detiene un sonido específico
 */
export function stopSound(soundType: string): void {
  const soundSystem = serviceRegistry.get<any>('soundSystem');
  if (soundSystem && typeof soundSystem.stopSound === 'function') {
    soundSystem.stopSound(soundType);
  } else {
    console.error('SoundSystemService not available');
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

// Make functions globally available for backward compatibility
window.playSound = playSound
window.playGlassSound = playGlassSound
window.playQueueSound = playQueueSound
window.stopSound = stopSound