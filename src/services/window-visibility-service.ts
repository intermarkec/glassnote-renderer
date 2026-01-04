import { BaseService } from './base-service';
import { IWindowVisibility } from './interfaces';
import { serviceRegistry } from './registry';

/**
 * Window Visibility Service
 * Handles window visibility across platforms (Electron, Android, Browser)
 * Absolute implementation with no fallbacks
 */
export class WindowVisibilityService extends BaseService implements IWindowVisibility {
  private platformContext: 'electron' | 'android' | 'browser' = 'browser';
  private windowVisible: boolean = false;

  constructor() {
    super('windowVisibility');
  }

  /**
   * Initialize the service
   */
  protected async onInitialize(): Promise<void> {
    // Determine platform context
    this.platformContext = this.detectPlatformContext();
    console.log(`WindowVisibilityService initialized for ${this.platformContext} platform`);
  }

  /**
   * Clean up the service
   */
  protected async onCleanup(): Promise<void> {
    // Nothing to clean up
  }

  /**
   * Detect the current platform context
   */
  private detectPlatformContext(): 'electron' | 'android' | 'browser' {
    // Absolute detection - no fallbacks
    if (typeof window !== 'undefined' && window.electronAPI) {
      return 'electron';
    }
    if (typeof window !== 'undefined' && window.AndroidBridge) {
      return 'android';
    }
    return 'browser';
  }

  /**
   * Show the application window (bring to front, make visible)
   */
  showWindow(): void {
    try {
      switch (this.platformContext) {
        case 'electron':
          this.showWindowElectron();
          break;
        case 'android':
          this.showWindowAndroid();
          break;
        case 'browser':
          this.showWindowBrowser();
          break;
      }
      this.windowVisible = true;
    } catch (error) {
      console.error('Failed to show window:', error);
      // No fallbacks - rethrow or handle as appropriate
      throw error;
    }
  }

  /**
   * Hide the application window (minimize or make transparent)
   */
  hideWindow(): void {
    try {
      switch (this.platformContext) {
        case 'electron':
          this.hideWindowElectron();
          break;
        case 'android':
          this.hideWindowAndroid();
          break;
        case 'browser':
          this.hideWindowBrowser();
          break;
      }
      this.windowVisible = false;
    } catch (error) {
      console.error('Failed to hide window:', error);
      throw error;
    }
  }

  /**
   * Check if window should be visible based on application state
   * and show/hide accordingly
   */
  checkWindowVisibility(): void {
    // Determine if window should be visible based on application state
    const shouldBeVisible = this.shouldWindowBeVisible();
    
    if (shouldBeVisible && !this.windowVisible) {
      this.showWindow();
    } else if (!shouldBeVisible && this.windowVisible) {
      this.hideWindow();
    }
  }

  /**
   * Get current window visibility state
   */
  isWindowVisible(): boolean {
    return this.windowVisible;
  }

  /**
   * Determine if window should be visible based on application state
   */
  private shouldWindowBeVisible(): boolean {
    // Check if there are active glasses that require window visibility
    if (window.activeGlasses && window.activeGlasses.size > 0) {
      return true;
    }
    
    // Check if there are glasses in the unified queue
    if (window.unifiedGlassQueue && window.unifiedGlassQueue.length > 0) {
      return true;
    }
    
    // Check if config menu is visible
    if (window._configMenuInstance && window._configMenuInstance.isVisible) {
      return true;
    }
    
    // Check if registration code is being displayed
    const keycodeElement = document.getElementById('keycode');
    if (keycodeElement && keycodeElement.textContent && keycodeElement.textContent.trim()) {
      return true;
    }
    
    return false;
  }

  /**
   * Show window in Electron environment
   */
  private showWindowElectron(): void {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    window.electronAPI.send('show-window');
  }

  /**
   * Hide window in Electron environment
   */
  private hideWindowElectron(): void {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    window.electronAPI.send('hide-window');
  }

  /**
   * Show window in Android environment
   */
  private showWindowAndroid(): void {
    if (!window.AndroidBridge) {
      throw new Error('AndroidBridge not available');
    }
    // Android WebView is always visible, no action needed
    // Optionally, we could bring the app to foreground if needed
    // For now, no-op as window is always visible in Android
  }

  /**
   * Hide window in Android environment
   */
  private hideWindowAndroid(): void {
    if (!window.AndroidBridge) {
      throw new Error('AndroidBridge not available');
    }
    // Cannot hide window in Android WebView, no-op
  }

  /**
   * Show window in Browser environment
   */
  private showWindowBrowser(): void {
    // In browser, we can't control window visibility directly
    // Focus the window if possible
    if (window.focus) {
      window.focus();
    }
    // Browser windows are always visible by definition
  }

  /**
   * Hide window in Browser environment
   */
  private hideWindowBrowser(): void {
    // In browser, we can't hide the window
    // We could blur or minimize but not supported
    // Browser windows are always visible by definition
  }
}

// Register the service
export function registerWindowVisibilityService(): void {
  const service = new WindowVisibilityService();
  serviceRegistry.register('windowVisibility', service);
}