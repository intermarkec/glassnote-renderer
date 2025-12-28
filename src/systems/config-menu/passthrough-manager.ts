import { ElectronBridge } from '../electron-bridge';

/**
 * Centralized manager for mouse event passthrough functionality
 * Handles the logic for enabling/disabling mouse event passthrough
 * based on mouse position relative to config menu container
 */
export class PassthroughManager {
  private static instance: PassthroughManager;
  private container: HTMLElement | null = null;
  private isPassthroughEnabled: boolean = false;
  private isMouseOverContainer: boolean = false;
  private mouseMoveHandler: ((event: MouseEvent) => void) | null = null;
  private mouseDownHandler: ((event: MouseEvent) => void) | null = null;
  private electronBridge: ElectronBridge | null = null;

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
  public initialize(container: HTMLElement, electronBridge?: ElectronBridge): void {
    this.container = container;
    if (electronBridge) {
      this.electronBridge = electronBridge;
    }
    
    // Clean up any existing handlers
    this.cleanupEventListeners();
    
    // Set up mouse event tracking
    this.setupMouseEventTracking();
    
    // Initially enable passthrough when menu is shown
    this.setPassthrough(true);
  }

  /**
   * Set up mouse event tracking to detect when mouse enters/leaves the container
   */
  private setupMouseEventTracking(): void {
    if (!this.container) return;

    // Track mouse position globally to detect when it's over the container
    // We need to use document-level events to capture mouse movement even when passthrough is enabled
    this.mouseMoveHandler = (event: MouseEvent) => {
      this.handleMouseMove(event);
    };

    this.mouseDownHandler = (event: MouseEvent) => {
      this.handleMouseDown(event);
    };

    // Use capture phase to ensure we get events before they might be blocked
    document.addEventListener('mousemove', this.mouseMoveHandler, { capture: true });
    document.addEventListener('mousedown', this.mouseDownHandler, { capture: true });
  }

  /**
   * Handle mouse move events to track position relative to container
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.container) return;

    const isInside = this.isMouseInsideContainer(event.clientX, event.clientY);
    
    if (isInside && !this.isMouseOverContainer) {
      // Mouse entered the container
      this.isMouseOverContainer = true;
      this.setPassthrough(false); // Disable passthrough to allow interaction with buttons
    } else if (!isInside && this.isMouseOverContainer) {
      // Mouse left the container
      this.isMouseOverContainer = false;
      this.setPassthrough(true); // Enable passthrough to allow clicking through to other windows
    }
  }

  /**
   * Handle mouse down events to check position (in case mouse entered without movement)
   */
  private handleMouseDown(event: MouseEvent): void {
    if (!this.container) return;

    const isInside = this.isMouseInsideContainer(event.clientX, event.clientY);
    
    if (isInside && !this.isMouseOverContainer) {
      // Mouse is inside container but we didn't detect it via mousemove
      this.isMouseOverContainer = true;
      this.setPassthrough(false);
    }
  }

  /**
   * Check if mouse coordinates are inside the container
   */
  private isMouseInsideContainer(clientX: number, clientY: number): boolean {
    if (!this.container) return false;
    
    const rect = this.container.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  /**
   * Enable or disable mouse event passthrough
   */
  public setPassthrough(enable: boolean): void {
    if (this.isPassthroughEnabled === enable) return;
    
    this.isPassthroughEnabled = enable;
    
    // Use Electron bridge if available
    if (this.electronBridge) {
      this.electronBridge.setIgnoreMouseEvents(enable);
    } else if (window.electronAPI) {
      // Fallback to direct electron API
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
   * Clean up event listeners
   */
  private cleanupEventListeners(): void {
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler, { capture: true });
      this.mouseMoveHandler = null;
    }
    
    if (this.mouseDownHandler) {
      document.removeEventListener('mousedown', this.mouseDownHandler, { capture: true });
      this.mouseDownHandler = null;
    }
  }

  /**
   * Clean up and reset the passthrough manager
   */
  public cleanup(): void {
    this.cleanupEventListeners();
    this.container = null;
    this.isMouseOverContainer = false;
    
    // Re-enable passthrough when cleaning up (menu is closing)
    this.setPassthrough(true);
  }

  /**
   * Force update passthrough state based on current mouse position
   * Useful for when container position/size changes
   */
  public updatePassthroughState(): void {
    // We can't get current mouse position without an event
    // This will be handled by the next mouse event
  }

  /**
   * Check if passthrough is currently enabled
   */
  public isPassthroughActive(): boolean {
    return this.isPassthroughEnabled;
  }

  /**
   * Check if mouse is currently over the container
   */
  public isMouseOver(): boolean {
    return this.isMouseOverContainer;
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