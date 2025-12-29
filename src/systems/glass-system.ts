import { PositionManager } from './glass/position-manager';
import { HTMLProcessor } from './glass/html-processor';
import { SVGProcessor } from './glass/svg-processor';
import { ImageProcessor } from './glass/image-processor';
import { ConfirmationButton } from './glass/confirmation-button';
import { FileLoader } from './glass/file-loader';

// Basic Glass system implementation for TypeScript + Vue migration

// Glass class implementation compatible with review transactions
class Glass {
  public url: string
  private message: any
  public element: HTMLElement | null = null
  private durationTimeout: NodeJS.Timeout | null = null
  private confirmationButtonTimeout: NodeJS.Timeout | null = null
  private positionKey: string | null = null
  private positionManager: PositionManager;
  public formResponse?: any;
  public confirmButton: any = null;
  public confirmationCounted: boolean = false;
  public isFinishing: boolean = false;
  public img: HTMLElement;
  public activeConnections: Map<string, WebSocket>;

  constructor(url: string | null, message: any) {
    this.url = url || ''
    this.message = message
    this.positionManager = new PositionManager();
    this.img = document.createElement('div'); // Crear un elemento temporal
    this.activeConnections = window.activeConnections || new Map();
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
    const style = this.element.style;
    style.position = 'fixed';
    style.left = '0';
    style.top = '0';
    style.width = '100%';
    style.height = '100%';
    style.pointerEvents = 'none';
    style.overflow = 'hidden';
    style.zIndex = '10000';

    // Configurar img con glass_id
    (this.element as any).glass_id = this.message.data.id;
    this.img = this.element; // Asignar el elemento a img para ConfirmationButton

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
            if (self.element) {
              self.element.appendChild(glassContent)
              document.body.appendChild(self.element)
              self.startFadeIn(glassContent)
              self._finalizeGlassSetup(glassContent, data)
            }
        })
        .catch((e) => {
          console.error('Error processing content:', JSON.stringify(e));
          self.cleanup();
        });
  }

  private _finalizeGlassSetup(glassContent: HTMLElement, data: any): void {
    const position = JSON.parse(data.position || '{"h":1,"v":1}');
    const askConfirmation = data.askConfirmation === true;
    const isForm = this._isFormContent(glassContent);
    const maxDurationWithoutConfirmation = 10; // segundos
    
    if (!askConfirmation) {
      // Si no tiene botón de confirmación, mostrar uno obligatorio después de 10 segundos
      this.confirmationButtonTimeout = setTimeout(() => {
        if (!this.confirmButton && !this.isFinishing) {
          this.confirmButton = new ConfirmationButton(this, position);
        }
      }, maxDurationWithoutConfirmation * 1000);

      // Configurar timeout de duración solo si no es formulario
      if (!isForm && data.duration) {
        this.durationTimeout = setTimeout(() => {
          this.finishGlass();
        }, data.duration * 1000);
      }
    } else {
      // Si ya tiene confirmación, agregar el botón independientemente de si es formulario
      this.confirmButton = new ConfirmationButton(this, position);
    }
  }

  private _isFormContent(glassContent: HTMLElement): boolean {
    try {
      // Primero verificar si ya está marcado como formulario en el dataset
      if (glassContent.dataset.isForm === 'true') {
        return true;
      }
      
      // Buscar el div principal dentro del contenido del glass
      const mainDiv = glassContent.querySelector('div');
      if (mainDiv && mainDiv.classList.contains('form')) {
        return true;
      }
      
      // Si es un iframe (HTML content), verificar dentro del iframe
      const iframe = glassContent.querySelector('iframe');
      if (iframe && iframe.contentDocument) {
        const iframeMainDiv = iframe.contentDocument.querySelector('div');
        if (iframeMainDiv && iframeMainDiv.classList.contains('form')) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking form content:', error);
      return false;
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
    if (this.isFinishing) {
      return;
    }
    this.isFinishing = true;
    
    // Cancelar timeout existente
    if (this.durationTimeout) {
      clearTimeout(this.durationTimeout);
      this.durationTimeout = null;
    }

    // Cancelar timeout de botón de confirmación
    if (this.confirmationButtonTimeout) {
      clearTimeout(this.confirmationButtonTimeout);
      this.confirmationButtonTimeout = null;
    }

    // Manejar botón de confirmación
    this._handleConfirmationButtonCleanup();

    if (!this.element) {
      this.cleanup();
      return;
    }
    
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

  private _handleConfirmationButtonCleanup(): void {
    if (this.confirmButton) {
      this.confirmButton.cleanup();
      this.confirmButton = null;
    }
  }

  public destroy(): void {
    this.finishGlass()
  }

  public cleanup(): void {
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

    // Cancel confirmation button timeout
    if (this.confirmationButtonTimeout) {
      clearTimeout(this.confirmationButtonTimeout)
      this.confirmationButtonTimeout = null
    }

    // Clean up confirmation button
    this._handleConfirmationButtonCleanup();

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
    this.img = document.createElement('div'); // Resetear a elemento temporal
    this.isFinishing = false;
    this.confirmationCounted = false;

    // Check window visibility
    if (typeof window.checkWindowVisibility === 'function') {
      window.checkWindowVisibility()
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
window.playQueueSound = SoundSystem.playQueueSound

// Duplicate message detection
window.isDuplicateMessage = function(messageId: string, _position: string): boolean {
  // Simple duplicate detection - check if same messageId is already in queue
  if (!window.unifiedGlassQueue) return false
  
  return window.unifiedGlassQueue.some((item: any) =>
    item.message.data.messageId === messageId
  )
}

// Window visibility checking - only define if not already defined
if (!window.checkWindowVisibility) {
  window.checkWindowVisibility = function(): void {
    // Simple implementation - in Electron this would show/hide the window
    console.log('Window visibility check')
  }
}

// Export for use in other modules
export { Glass, SoundSystem, FileLoader }