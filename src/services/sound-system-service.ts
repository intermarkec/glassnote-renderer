import { BaseService } from './base-service';
import { ISoundSystem } from './interfaces';

interface AudioInstances {
  [key: string]: HTMLAudioElement;
}

/**
 * Sound System Service
 * Handles audio playback for glass and queue sounds
 */
export class SoundSystemService extends BaseService implements ISoundSystem {
  private audioInstances: AudioInstances = {};
  private volume: number = 0.5;

  constructor() {
    super('soundSystem');
  }

  /**
   * Initialize the sound system
   */
  protected async onInitialize(): Promise<void> {
    // Preload sounds for better performance
    await this.preloadSounds();
    console.log('Sound system initialized');
  }

  /**
   * Clean up the sound system
   */
  protected async onCleanup(): Promise<void> {
    // Stop all sounds
    Object.keys(this.audioInstances).forEach(soundType => {
      this.stopSound(soundType);
    });
    
    // Clear audio instances
    this.audioInstances = {};
    
    console.log('Sound system cleaned up');
  }

  /**
   * Play a sound by type
   */
  playSound(soundType: string): void {
    try {
      let soundFile: string;
      
      // Determine which sound file to use based on platform
      if (typeof window.AndroidBridge !== 'undefined') {
        // Android with AndroidBridge
        soundFile = soundType === 'glass' ? './sound/glasscell.wav' : './sound/queuecell.wav';
      } else {
        // Desktop or other devices
        soundFile = soundType === 'glass' ? './sound/glass.wav' : './sound/queue.wav';
      }
      
      // Stop previous sound of the same type if it exists
      if (this.audioInstances[soundType]) {
        try {
          this.audioInstances[soundType].pause();
          this.audioInstances[soundType].currentTime = 0;
        } catch (e) {
          console.error('Error stopping previous ' + soundType + ' sound:', e);
        }
      }
      
      const audio = new Audio(soundFile);
      audio.volume = this.volume;
      this.audioInstances[soundType] = audio;
      
      audio.play().catch(function(error) {
        // Ignore playback errors (user might have audio disabled)
        console.log('Audio playback error (non-critical):', error);
      });
    } catch (error) {
      console.error('Could not play ' + soundType + ' sound:', error);
    }
  }

  /**
   * Stop a specific sound
   */
  stopSound(soundType: string): void {
    try {
      if (this.audioInstances[soundType]) {
        this.audioInstances[soundType].pause();
        this.audioInstances[soundType].currentTime = 0;
      }
    } catch (error) {
      console.error('Error stopping ' + soundType + ' sound:', error);
    }
  }

  /**
   * Play the glass sound when a glass is displayed
   */
  playGlassSound(): void {
    this.playSound('glass');
  }

  /**
   * Play the queue sound when a message enters the queue
   */
  playQueueSound(): void {
    this.playSound('queue');
  }

  /**
   * Preload sounds for better performance
   */
  async preloadSounds(): Promise<void> {
    const soundFiles = [
      './sound/glass.wav',
      './sound/glass2.wav',
      './sound/glasscell.wav',
      './sound/glasscell2.wav',
      './sound/queue.wav',
      './sound/queuecell.wav'
    ];

    // Create audio elements to preload (but don't play them)
    soundFiles.forEach(soundFile => {
      try {
        const audio = new Audio();
        audio.src = soundFile;
        audio.preload = 'auto';
        // Store reference to prevent garbage collection
        (audio as any)._preloadRef = true;
      } catch (error) {
        // Ignore preload errors
      }
    });
  }

  /**
   * Set volume for all sounds (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    
    // Update volume for all existing audio instances
    Object.values(this.audioInstances).forEach(audio => {
      audio.volume = this.volume;
    });
  }
}