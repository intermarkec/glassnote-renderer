import { ConfigMenu } from './config-menu';

/**
 * Electron Bridge - Handles communication between Electron main process and Vue renderer
 */
export class ElectronBridge {
  private configMenu: ConfigMenu | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Electron bridge and set up event listeners
   */
  private initialize(): void {
    if (!window.electronAPI) {
      console.warn('Electron API not available - running in browser mode');
      return;
    }

    this.setupEventListeners();
  }

  /**
   * Set up all Electron IPC event listeners
   */
  private setupEventListeners(): void {
    // Handler for show-code command
    window.electronAPI?.receive('show-code', () => {
      this.showRegistrationCode();
    });

    // Handler for hide-code command
    window.electronAPI?.receive('hide-code', () => {
      this.hideRegistrationCode();
    });

    // Handler for check-code-visible command
    window.electronAPI?.receive('check-code-visible', (requestId: string) => {
      this.checkCodeVisible(requestId);
    });

    // Handler for show-config-menu command from taskbar
    window.electronAPI?.receive('show-config-menu', (view: string) => {
      this.showConfigMenu(view);
    });

    // Handler for app data
    window.electronAPI?.receive('app-data', (data: any) => {
      console.log('Received app data:', data);
    });

    // Handler for servers list
    window.electronAPI?.receive('servers-list', (servers: any[]) => {
      console.log('Received servers list:', servers);
    });
  }

  /**
   * Show registration code
   */
  public showRegistrationCode(): void {
    // Make the window visible first
    this.checkWindowVisibility();

    // Start registration process
    if (typeof window.requestRegistrationCode === 'function') {
      window.requestRegistrationCode();
    } else {
      console.error('requestRegistrationCode function not available');
    }
  }

  /**
   * Hide registration code
   */
  public hideRegistrationCode(): void {
    // Close registration connection
    if (typeof window.closeRegistrationConnection === 'function') {
      window.closeRegistrationConnection();
    }

    // Hide the window
    this.checkWindowVisibility();
  }

  /**
   * Check if registration code is visible
   */
  private checkCodeVisible(requestId: string): void {
    const keycodeElement = document.getElementById('keycode');
    const isVisible = !!(keycodeElement &&
                        keycodeElement.textContent &&
                        keycodeElement.textContent.trim());
    
    if (window.electronAPI) {
      window.electronAPI.send('check-code-visible-response', {
        requestId: requestId,
        isVisible: isVisible,
      });
    }
  }

  /**
   * Show config menu from taskbar
   */
  public showConfigMenu(view: string): void {
    // Make the window visible first
    this.checkWindowVisibility();

    // Show the config menu with specified view
    if (this.configMenu) {
      this.configMenu.toggle();
    } else {
      console.error('ConfigMenu instance not available');
      this.showConfigMenuFallback();
    }
  }

  /**
   * Fallback method to show config menu
   */
  private showConfigMenuFallback(): void {
    // Create config menu instance if not exists
    if (!this.configMenu) {
      this.configMenu = new ConfigMenu();
    }

    // Show the config menu
    if (this.configMenu) {
      this.configMenu.show();
    }
  }

  /**
   * Check window visibility and show/hide as needed
   */
  private checkWindowVisibility(): void {
    if (window.electronAPI) {
      window.electronAPI.send('show-window');
    }
  }

  /**
   * Set ConfigMenu instance
   */
  public setConfigMenu(configMenu: ConfigMenu): void {
    this.configMenu = configMenu;
  }

  /**
   * Open external URL
   */
  public openExternal(url: string): void {
    if (window.electronAPI) {
      window.electronAPI.send('open-external', url);
    } else {
      window.open(url, '_blank');
    }
  }

  /**
   * Open external browser
   */
  public openExternalBrowser(url: string): void {
    if (window.electronAPI) {
      window.electronAPI.send('open-external-browser', url);
    } else {
      window.open(url, '_blank');
    }
  }

  /**
   * Open registration window
   */
  public openRegistrationWindow(url: string): void {
    if (window.electronAPI) {
      window.electronAPI.send('open-registration-window', url);
    } else {
      window.open(url, '_blank');
    }
  }

  /**
   * Get user data
   */
  public async getUserData(key: string, nestedKey?: string): Promise<any> {
    if (window.electronAPI) {
      return await window.electronAPI.getUserData(key, nestedKey);
    }
    return null;
  }

  /**
   * Set user data
   */
  public async setUserData(key: string, nestedKey: string | undefined, value: any): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.setUserData(key, nestedKey, value);
    }
  }

  /**
   * Remove user data
   */
  public async removeUserData(key: string, nestedKey?: string): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.removeUserData(key, nestedKey);
    }
  }

  /**
   * Show window
   */
  public showWindow(): void {
    if (window.electronAPI) {
      window.electronAPI.send('show-window');
    }
  }

  /**
   * Hide window
   */
  public hideWindow(): void {
    if (window.electronAPI) {
      window.electronAPI.send('hide-window');
    }
  }

  /**
   * Set ignore mouse events
   */
  public setIgnoreMouseEvents(ignore: boolean): void {
    if (window.electronAPI) {
      if (ignore) {
        window.electronAPI.send('set-ignore-events-true');
      } else {
        window.electronAPI.send('set-ignore-events-false');
      }
    }
  }
}

// Global instance
let electronBridge: ElectronBridge | null = null;

/**
 * Initialize Electron bridge
 */
export function initializeElectronBridge(): ElectronBridge {
  if (!electronBridge) {
    electronBridge = new ElectronBridge();
  }
  return electronBridge;
}

/**
 * Get Electron bridge instance
 */
export function getElectronBridge(): ElectronBridge | null {
  return electronBridge;
}

// Make functions globally available for backward compatibility
declare global {
  interface Window {
    initializeElectronHandlers?: () => void;
    showRegistrationCode?: () => void;
    hideRegistrationCode?: () => void;
    showConfigMenu?: (view: string) => void;
    checkWindowVisibility?: () => void;
  }
}

// Set up global functions for backward compatibility
window.initializeElectronHandlers = () => {
  initializeElectronBridge();
};

window.showRegistrationCode = () => {
  const bridge = getElectronBridge();
  if (bridge) {
    bridge.showRegistrationCode();
  }
};

window.hideRegistrationCode = () => {
  const bridge = getElectronBridge();
  if (bridge) {
    bridge.hideRegistrationCode();
  }
};

window.showConfigMenu = (view: string) => {
  const bridge = getElectronBridge();
  if (bridge) {
    bridge.showConfigMenu(view);
  }
};

window.checkWindowVisibility = () => {
  const bridge = getElectronBridge();
  if (bridge) {
    bridge.showWindow();
  }
};