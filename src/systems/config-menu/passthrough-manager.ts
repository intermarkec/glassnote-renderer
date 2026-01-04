import { serviceRegistry } from '../../services/registry';
import { IPassthroughService } from '../../services/interfaces';

/**
 * Adapter for the centralized passthrough service
 * Maintains compatibility with existing code while delegating to the new service
 */
export class PassthroughManager {
  private static instance: PassthroughManager;
  private container: HTMLElement | null = null;
  private elementId: string | null = null;
  private passthroughService: IPassthroughService | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PassthroughManager {
    if (!PassthroughManager.instance) {
      PassthroughManager.instance = new PassthroughManager();
    }
    return PassthroughManager.instance;
  }

  /**
   * Initialize the passthrough manager with a container
   */
  public initialize(container: HTMLElement): void {
    this.container = container;
    
    // Get the passthrough service from registry
    try {
      this.passthroughService = serviceRegistry.get<IPassthroughService>('passthrough');
    } catch (error) {
      console.error('PassthroughService not available in registry:', error);
      return;
    }
    
    // Generate unique ID for this container
    this.elementId = `config-menu-${Date.now()}`;
    
    // Register the container with the service
    this.passthroughService.registerElement(
      this.elementId,
      () => this.container,
      100 // High priority for config menu
    );
    
    // console.log(`PassthroughManager: Registered container as "${this.elementId}"`);
  }

  /**
   * Enable or disable mouse event passthrough
   */
  public setPassthrough(enable: boolean): void {
    if (this.passthroughService) {
      this.passthroughService.setPassthrough(enable);
    } else {
      // Fallback to direct API if service not available
      this.directSetPassthrough(enable);
    }
  }

  /**
   * Direct passthrough setting (fallback)
   */
  private directSetPassthrough(enable: boolean): void {
    // Use Electron bridge if available
    if (window.electronAPI) {
      if (enable) {
        window.electronAPI.send('set-ignore-events-true');
      } else {
        window.electronAPI.send('set-ignore-events-false');
      }
    }
    
    // For Android WebView
    if (window.AndroidBridge) {
      if (enable) {
        window.AndroidBridge.setIgnoreEventsTrue();
      } else {
        window.AndroidBridge.setIgnoreEventsFalse();
      }
    }
  }

  /**
   * Clean up and reset the passthrough manager
   */
  public cleanup(): void {
    // Unregister from service
    if (this.passthroughService && this.elementId) {
      this.passthroughService.unregisterElement(this.elementId);
      this.elementId = null;
    }
    
    this.container = null;
    
    // Re-enable passthrough when cleaning up (menu is closing)
    this.setPassthrough(true);
    
    // console.log('PassthroughManager: Cleaned up');
  }

  /**
   * Force update passthrough state based on current mouse position
   * Useful for when container position/size changes
   */
  public updatePassthroughState(): void {
    if (this.passthroughService && this.elementId) {
      this.passthroughService.updateElement(this.elementId);
    }
  }

  /**
   * Check if passthrough is currently enabled
   */
  public isPassthroughActive(): boolean {
    if (this.passthroughService) {
      return this.passthroughService.isPassthroughActive();
    }
    return true; // Default to enabled if service not available
  }

  /**
   * Check if mouse is currently over the container
   * Note: This is now handled by the service, but we can approximate
   */
  public isMouseOver(): boolean {
    // This information is now managed by the service
    // We could query the service if it exposed this information
    return false;
  }

  /**
   * Static method to enable passthrough
   */
  public static enablePassthrough(): void {
    const instance = PassthroughManager.getInstance();
    instance.setPassthrough(true);
  }

  /**
   * Static method to disable passthrough
   */
  public static disablePassthrough(): void {
    const instance = PassthroughManager.getInstance();
    instance.setPassthrough(false);
  }

  /**
   * Static method to check if passthrough is active
   */
  public static isPassthroughActive(): boolean {
    const instance = PassthroughManager.getInstance();
    return instance.isPassthroughActive();
  }
}

// Global instance for easy access
declare global {
  interface Window {
    passthroughManager?: PassthroughManager;
  }
}

// Initialize global instance
export function initializePassthroughManager(): PassthroughManager {
  const manager = PassthroughManager.getInstance();
  window.passthroughManager = manager;
  return manager;
}