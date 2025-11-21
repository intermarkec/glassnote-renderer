import { PositionManager } from './glass/position-manager';
import { HTMLProcessor } from './glass/html-processor';
import { SVGProcessor } from './glass/svg-processor';
import { ImageProcessor } from './glass/image-processor';

// Basic Glass system implementation for TypeScript + Vue migration

// Glass class implementation compatible with review transactions
class Glass {
  private url: string | null
  private message: any
  public element: HTMLElement | null = null
  private durationTimeout: NodeJS.Timeout | null = null
  private positionKey: string | null = null
  private positionManager: PositionManager;
  public formResponse?: any;

  constructor(url: string | null, message: any) {
    this.url = url
    this.message = message
    this.positionManager = new PositionManager();
    this.handleGlassDisplay()
  }

  private handleGlassDisplay(): void {
    try {
      const data = this.message.data
      const position = JSON.parse(data.position || '{"h":1,"v":1}')
      this.positionKey = position.h + ':' + position.v
      
      this.registerGlassPosition()
      this.displayGlass()
    } catch (error) {
      console.error('Error handling glass display:', error)
      this.cleanup()
    }
  }

  private registerGlassPosition(): void {
    if (window.activeGlasses && this.positionKey) {
      window.activeGlasses.set(this.positionKey, {
        id: this.message.data.id,
        timestamp: Date.now(),
      })
    }
  }

  private displayGlass(): void {
    // Play glass sound if available
    if (typeof window.playGlassSound === 'function') {
      window.playGlassSound()
    }

    this.initialize()
  }

  private initialize(): void {
    const self = this;
    // Create main container
    this.element = document.createElement('div')
    this.element.style.position = 'fixed'
    this.element.style.left = '0'
    this.element.style.top = '0'
    this.element.style.width = '100%'
    this.element.style.height = '100%'
    this.element.style.pointerEvents = 'none'
    this.element.style.overflow = 'hidden'
    this.element.style.zIndex = '10000'

    // Create glass content with fade animation
    const glassContent = this.createGlassContent()
    
    // Setup positioning
    this.setupPositioning(glassContent)
    
    // Add content based on message type
    const data = this.message.data;
    const uploads = JSON.parse(data.uploads);
    const upload = uploads[0];
    const processor = this._getContentProcessor(upload.mimetype, data);

    processor.process(glassContent, data, upload)
        .then(function() {
            // Finalizar configuración
            self.element.appendChild(glassContent)
            document.body.appendChild(self.element)
            self.startFadeIn(glassContent)
        })
        .catch((e) => {
          console.error('Error processing content:', JSON.stringify(e));
          self.cleanup();
        });


    // Set up auto-removal if duration is specified
    if (this.message.data.duration) {
      this.durationTimeout = setTimeout(() => {
        this.finishGlass()
      }, this.message.data.duration * 1000)
    }
  }

  private _getContentProcessor(mimetype: string, messageData: any): HTMLProcessor | SVGProcessor | ImageProcessor {
      // Prioritize messageType over mimetype for determining the processor
      if (messageData.messageType === 'html' || messageData.messageType === 'form') {
          return new HTMLProcessor(this);
      } else if (mimetype === 'image/svg+xml') {
          return new SVGProcessor(this);
      } else {
          return new ImageProcessor(this);
      }
  }

  private createGlassContent(): HTMLElement {
    const glassContent = document.createElement('div')
    glassContent.className = 'glass-content'
    
    Object.assign(glassContent.style, {
      position: 'absolute',
      opacity: '0',
      transition: 'opacity 1s ease-in-out',
      willChange: 'transform, opacity',
      transform: 'translateZ(0)',
      zIndex: '10001'
    })

    return glassContent
  }

  private setupPositioning(glassContent: HTMLElement): void {
    try {
      const position = JSON.parse(this.message.data.position || '{"h":1,"v":1}');
      this.positionManager.positionElement(glassContent, position);
      const pos = this.positionManager.getPositionStrings(position);
      glassContent.style.transformOrigin = pos.hOrigin + ' ' + pos.vOrigin;
    } catch (error) {
      console.error('Error setting up positioning:', error);
      // Fallback to center positioning
      glassContent.style.left = '50%';
      glassContent.style.top = '50%';
      glassContent.style.transform = 'translate(-50%, -50%)';
      glassContent.style.transformOrigin = 'center center';
    }
  }

  private startFadeIn(glassContent: HTMLElement): void {
    const startFadeIn = () => {
      const contentRect = glassContent.getBoundingClientRect()
      if (contentRect.width > 0 && contentRect.height > 0) {
        glassContent.style.opacity = this.message.data.transparency || '1'
      } else {
        requestAnimationFrame(startFadeIn)
      }
    }

    setTimeout(() => {
      requestAnimationFrame(startFadeIn)
    }, 50)
  }

  public finishGlass(): void {
    if (!this.element) return
    
    const glassContent = this.element.querySelector('.glass-content') as HTMLElement
    if (glassContent) {
      // Start fade out animation
      glassContent.style.opacity = '0'
      
      // Wait for fade out to complete before cleanup
      setTimeout(() => {
        this.cleanup()
      }, 1000)
    } else {
      this.cleanup()
    }
  }

  public destroy(): void {
    this.finishGlass()
  }

  private cleanup(): void {
    // Remove from unified queue when glass finishes displaying
    if (window.removeFromUnifiedQueue && this.message && this.message.data) {
      if (this.message.data.messageId) {
        window.removeFromUnifiedQueue(this.message.data.messageId)
      } else if (this.message.data.id) {
        window.removeFromUnifiedQueue(this.message.data.id.toString())
      }
    }

    // Cancel duration timeout
    if (this.durationTimeout) {
      clearTimeout(this.durationTimeout)
      this.durationTimeout = null
    }

    // Clean up active position
    if (this.positionKey && window.activeGlasses) {
      window.activeGlasses.delete(this.positionKey)
    }

    // Remove element from DOM
    if (this.element && this.element.parentNode) {
      document.body.removeChild(this.element)
    }

    // Reset state
    this.element = null
    this.positionKey = null

    // Check window visibility
    if (typeof window.checkWindowVisibility === 'function') {
      window.checkWindowVisibility()
    }
  }
}

// FileLoader implementation for package version loading
class FileLoader {
  static async loadPackageVersion(): Promise<string> {
    try {
      // In a real implementation, this would load from package.json
      // For now, return a default version
      return '1.0.0'
    } catch (error) {
      console.error('Failed to load package version:', error)
      throw error
    }
  }
}

// Sound system for playing glass sounds
class SoundSystem {
  static playQueueSound(): void {
    // In a real implementation, this would play the queue sound
    console.log('Queue sound would play here')
  }

  static playGlassSound(): void {
    // In a real implementation, this would play the glass sound
    console.log('Glass sound would play here')
  }
}

// Initialize global variables
window.activeGlasses = window.activeGlasses || new Map()

// Make classes globally available
window.Glass = Glass as any
;(window as any).FileLoader = FileLoader
window.playQueueSound = SoundSystem.playQueueSound

// Duplicate message detection
window.isDuplicateMessage = function(messageId: string, position: string): boolean {
  // Simple duplicate detection - check if same messageId is already in queue
  if (!window.unifiedGlassQueue) return false
  
  return window.unifiedGlassQueue.some((item: any) => 
    item.message.data.messageId === messageId
  )
}

// Window visibility checking
window.checkWindowVisibility = function(): void {
  // Simple implementation - in Electron this would show/hide the window
  console.log('Window visibility check')
}

// Export for use in other modules
export { Glass, FileLoader, SoundSystem }