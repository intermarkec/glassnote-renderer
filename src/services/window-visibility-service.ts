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
    console.log('WindowVisibilityService: checkWindowVisibility called, current windowVisible:', this.windowVisible);
    
    // Determine if window should be visible based on application state
    const shouldBeVisible = this.shouldWindowBeVisible();
    
    console.log('WindowVisibilityService: shouldBeVisible:', shouldBeVisible, 'windowVisible:', this.windowVisible);
    
    if (shouldBeVisible && !this.windowVisible) {
      console.log('WindowVisibilityService: Showing window (shouldBeVisible=true, windowVisible=false)');
      this.showWindow();
    } else if (!shouldBeVisible && this.windowVisible) {
      console.log('WindowVisibilityService: Hiding window (shouldBeVisible=false, windowVisible=true)');
      this.hideWindow();
    } else {
      console.log('WindowVisibilityService: No action needed (shouldBeVisible:', shouldBeVisible, 'windowVisible:', this.windowVisible, ')');
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
      console.log('WindowVisibilityService: shouldWindowBeVisible returning true - activeGlasses size:', window.activeGlasses.size);
      return true;
    }
    
    // Check if there are glasses in the unified queue
    if (window.unifiedGlassQueue && window.unifiedGlassQueue.length > 0) {
      console.log('WindowVisibilityService: shouldWindowBeVisible returning true - unifiedGlassQueue length:', window.unifiedGlassQueue.length);
      return true;
    }
    
    // Check if config menu is visible - check both the isVisible flag AND actual DOM visibility
    const configMenuInstanceExists = !!window._configMenuInstance;
    const configMenuVisibleByFlag = window._configMenuInstance && window._configMenuInstance.isVisible;
    
    // Also check if config menu container is actually visible in DOM
    let configMenuContainerVisible = false;
    if (window._configMenuInstance && typeof window._configMenuInstance.getContainer === 'function') {
      try {
        const container = window._configMenuInstance.getContainer();
        if (container) {
          const computedStyle = window.getComputedStyle(container);
          configMenuContainerVisible = computedStyle.display !== 'none' &&
                                       computedStyle.visibility !== 'hidden' &&
                                       container.parentNode !== null;
        }
      } catch (error) {
        console.error('WindowVisibilityService: Error checking config menu container visibility:', error);
      }
    }
    
    // Also check for any config-menu element in the DOM (safety check)
    let anyConfigMenuElementVisible = false;
    try {
      const configMenuElements = document.querySelectorAll('.config-menu');
      for (let i = 0; i < configMenuElements.length; i++) {
        const element = configMenuElements[i] as HTMLElement;
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display !== 'none' &&
            computedStyle.visibility !== 'hidden' &&
            element.parentNode !== null) {
          anyConfigMenuElementVisible = true;
          console.log('WindowVisibilityService: Found visible config-menu element in DOM');
          break;
        }
      }
    } catch (error) {
      console.error('WindowVisibilityService: Error checking for config-menu elements:', error);
    }
    
    const configMenuVisible = configMenuVisibleByFlag || configMenuContainerVisible || anyConfigMenuElementVisible;
    
    if (configMenuVisible) {
      console.log('WindowVisibilityService: shouldWindowBeVisible returning true - config menu is visible');
      console.log('WindowVisibilityService: configMenuInstance exists:', configMenuInstanceExists,
                  'isVisible flag:', configMenuVisibleByFlag,
                  'container visible:', configMenuContainerVisible);
      return true;
    } else {
      console.log('WindowVisibilityService: config menu check - instance exists:', configMenuInstanceExists,
                  'isVisible flag:', configMenuVisibleByFlag,
                  'container visible:', configMenuContainerVisible);
    }
    
    // Check if registration code is being displayed
    const keycodeElement = document.getElementById('keycode');
    const hasKeycode = keycodeElement && keycodeElement.textContent && keycodeElement.textContent.trim();
    if (hasKeycode) {
      console.log('WindowVisibilityService: shouldWindowBeVisible returning true - registration code is displayed');
      return true;
    }
    
    console.log('WindowVisibilityService: shouldWindowBeVisible returning false - no reason to keep window visible');
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