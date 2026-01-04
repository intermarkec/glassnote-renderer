import { BaseService } from './base-service';
import { serviceRegistry } from './registry';

/**
 * Interface for interactive elements that need passthrough control
 */
interface InteractiveElement {
  id: string;
  getElement: () => HTMLElement | null;
  priority: number;
  lastBounds: DOMRect | null;
  isIframe?: boolean;
  iframeWindow?: Window | null;
}

/**
 * Centralized service for managing mouse event passthrough
 * Handles registration of interactive elements and determines
 * when to enable/disable passthrough based on mouse position
 */
export class PassthroughService extends BaseService {
  private static instance: PassthroughService;
  private elements: Map<string, InteractiveElement> = new Map();
  private isPassthroughEnabled: boolean = true;
  private checkInterval: number | null = null;
  private lastMousePosition: { x: number; y: number } | null = null;
  private isMonitoring: boolean = false;
  private readonly CHECK_INTERVAL_MS = 300;
  private isMouseOverIframe: boolean = false;
  private currentIframeId: string | null = null;

  private constructor() {
    super('passthrough');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PassthroughService {
    if (!PassthroughService.instance) {
      PassthroughService.instance = new PassthroughService();
    }
    return PassthroughService.instance;
  }

  /**
   * Service-specific initialization
   */
  protected async onInitialize(): Promise<void> {
    console.log('PassthroughService: Initializing');
    
    // Set up mouse move listener to track position
    this.setupMouseTracking();
    
    // Start monitoring
    this.startMonitoring();
    
    console.log('PassthroughService: Initialized successfully');
  }

  /**
   * Register an interactive element that needs passthrough control
   * @param id Unique identifier for the element
   * @param getElement Function that returns the element (or null if not available)
   * @param priority Priority for overlapping elements (higher = more important)
   * @param isIframe Whether this element is an iframe (needs special handling)
   */
  public registerElement(id: string, getElement: () => HTMLElement | null, priority: number = 50, isIframe: boolean = false): void {
    if (this.elements.has(id)) {
      console.warn(`PassthroughService: Element with id "${id}" is already registered`);
      return;
    }

    const element: InteractiveElement = {
      id,
      getElement,
      priority,
      lastBounds: null,
      isIframe,
      iframeWindow: null
    };

    this.elements.set(id, element);
    console.log(`PassthroughService: Registered element "${id}" with priority ${priority}, isIframe: ${isIframe}`);
    
    // Update bounds immediately
    this.updateElementBounds(id);
    
    // Setup iframe event listeners if needed
    if (isIframe) {
      this.setupIframeEventListeners(id);
    }
    
    // Recalculate passthrough state
    this.checkAndUpdatePassthrough();
  }

  /**
   * Unregister an interactive element
   * @param id Unique identifier for the element
   */
  public unregisterElement(id: string): void {
    if (this.elements.delete(id)) {
      console.log(`PassthroughService: Unregistered element "${id}"`);
      
      // Recalculate passthrough state
      this.checkAndUpdatePassthrough();
    }
  }

  /**
   * Update element bounds (call when element position/size changes)
   * @param id Unique identifier for the element
   */
  public updateElement(id: string): void {
    if (this.elements.has(id)) {
      this.updateElementBounds(id);
      this.checkAndUpdatePassthrough();
    }
  }

  /**
   * Start monitoring mouse position and updating passthrough state
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Clear any existing interval
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
    }

    // Set up periodic checking
    this.checkInterval = window.setInterval(() => {
      this.checkAndUpdatePassthrough();
    }, this.CHECK_INTERVAL_MS);

    console.log('PassthroughService: Started monitoring');
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    console.log('PassthroughService: Stopped monitoring');
  }

  /**
   * Check if passthrough is currently enabled
   */
  public isPassthroughActive(): boolean {
    return this.isPassthroughEnabled;
  }

  /**
   * Enable or disable passthrough directly (for manual control)
   * @param enable Whether to enable passthrough
   */
  public setPassthrough(enable: boolean): void {
    if (this.isPassthroughEnabled === enable) {
      return;
    }

    this.isPassthroughEnabled = enable;
    this.applyPassthroughState();
  }

  /**
   * Service-specific cleanup
   */
  protected async onCleanup(): Promise<void> {
    this.stopMonitoring();
    this.elements.clear();
    this.lastMousePosition = null;
    
    // Re-enable passthrough when cleaning up
    this.setPassthrough(true);
    
    console.log('PassthroughService: Cleaned up');
  }

  /**
   * Set up mouse tracking to get current mouse position
   */
  private setupMouseTracking(): void {
    document.addEventListener('mousemove', (event) => {
      this.lastMousePosition = {
        x: event.clientX,
        y: event.clientY
      };
      
      // Update passthrough immediately on mouse move for responsiveness
      this.checkAndUpdatePassthrough();
    }, { capture: true });
  }

  /**
   * Update bounds for a specific element
   * @param id Element identifier
   */
  private updateElementBounds(id: string): void {
    const elementInfo = this.elements.get(id);
    if (!elementInfo) {
      return;
    }

    const element = elementInfo.getElement();
    if (element && element.isConnected) {
      elementInfo.lastBounds = element.getBoundingClientRect();
    } else {
      elementInfo.lastBounds = null;
    }
  }

  /**
   * Check if mouse is over any registered element (including iframes)
   * @returns True if mouse is over an interactive element
   */
  private isMouseOverElement(): boolean {
    if (!this.lastMousePosition && !this.isMouseOverIframe) {
      return false;
    }

    // If mouse is over an iframe (detected via iframe events)
    if (this.isMouseOverIframe && this.currentIframeId) {
      return true;
    }

    // Check regular elements
    const { x, y } = this.lastMousePosition || { x: 0, y: 0 };
    let highestPriorityElement: InteractiveElement | null = null;

    // Check all elements
    for (const elementInfo of this.elements.values()) {
      if (!elementInfo.lastBounds) {
        continue;
      }

      const bounds = elementInfo.lastBounds;
      const isInside = x >= bounds.left && x <= bounds.right &&
                       y >= bounds.top && y <= bounds.bottom;

      if (isInside) {
        // If we found an element, check if it has higher priority than current
        if (!highestPriorityElement || elementInfo.priority > highestPriorityElement.priority) {
          highestPriorityElement = elementInfo;
        }
      }
    }

    return highestPriorityElement !== null;
  }

  /**
   * Check current state and update passthrough if needed
   */
  private checkAndUpdatePassthrough(): void {
    // Update bounds for all elements
    this.updateAllElementBounds();
    
    // Determine if mouse is over any element
    const shouldDisablePassthrough = this.isMouseOverElement();
    
    // Update passthrough state if changed
    if (shouldDisablePassthrough && this.isPassthroughEnabled) {
      this.setPassthrough(false);
    } else if (!shouldDisablePassthrough && !this.isPassthroughEnabled) {
      this.setPassthrough(true);
    }
  }

  /**
   * Update bounds for all registered elements
   */
  private updateAllElementBounds(): void {
    for (const [id] of this.elements) {
      this.updateElementBounds(id);
    }
  }

  /**
   * Apply passthrough state to the window
   */
  private applyPassthroughState(): void {
    console.log(`PassthroughService: Setting passthrough to ${this.isPassthroughEnabled ? 'enabled' : 'disabled'}`);
    
    // Use Electron bridge if available
    if (window.electronAPI) {
      if (this.isPassthroughEnabled) {
        window.electronAPI.send('set-ignore-events-true');
      } else {
        window.electronAPI.send('set-ignore-events-false');
      }
    }
    
    // For Android WebView
    if (window.AndroidBridge) {
      if (this.isPassthroughEnabled) {
        window.AndroidBridge.setIgnoreEventsTrue();
      } else {
        window.AndroidBridge.setIgnoreEventsFalse();
      }
    }
  }

  /**
   * Get the number of registered elements
   */
  public getElementCount(): number {
    return this.elements.size;
  }

  /**
   * Get all registered element IDs
   */
  public getRegisteredElementIds(): string[] {
    return Array.from(this.elements.keys());
  }

  /**
   * Setup event listeners for iframe elements
   * @param id Element identifier
   */
  private setupIframeEventListeners(id: string): void {
    const elementInfo = this.elements.get(id);
    if (!elementInfo || !elementInfo.isIframe) {
      return;
    }

    const element = elementInfo.getElement();
    if (!element || !(element instanceof HTMLIFrameElement)) {
      return;
    }

    const iframe = element as HTMLIFrameElement;
    
    // Try to access iframe content after it loads
    const setupIframeEvents = () => {
      try {
        if (iframe.contentWindow && iframe.contentDocument) {
          elementInfo.iframeWindow = iframe.contentWindow;
          
          // Add mouse event listeners inside the iframe
          iframe.contentDocument.addEventListener('mousemove', (event) => {
            // Convert iframe coordinates to parent window coordinates
            const rect = iframe.getBoundingClientRect();
            this.lastMousePosition = {
              x: rect.left + event.clientX,
              y: rect.top + event.clientY
            };
            
            // Mark that mouse is over iframe
            this.isMouseOverIframe = true;
            this.currentIframeId = id;
            
            // Update passthrough immediately
            this.checkAndUpdatePassthrough();
          }, { capture: true });

          iframe.contentDocument.addEventListener('mouseleave', () => {
            this.isMouseOverIframe = false;
            this.currentIframeId = null;
            this.checkAndUpdatePassthrough();
          }, { capture: true });

          console.log(`PassthroughService: Setup iframe event listeners for "${id}"`);
        }
      } catch (error) {
        // Cross-origin iframe - can't access content
        console.warn(`PassthroughService: Cannot access iframe content for "${id}" (cross-origin):`, error);
        
        // Fallback: use iframe element bounds only
        // This will work for mouse entering/leaving the iframe container
        // but not for movements inside the iframe
      }
    };

    // Wait for iframe to load
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
      setupIframeEvents();
    } else {
      iframe.addEventListener('load', setupIframeEvents);
    }
  }
}

// Register with service registry
export function registerPassthroughService(): void {
  const service = PassthroughService.getInstance();
  serviceRegistry.register('passthrough', service);
}

// Make service available globally for easy access
declare global {
  interface Window {
    passthroughService?: PassthroughService;
  }
}

// Initialize global instance
window.passthroughService = PassthroughService.getInstance();