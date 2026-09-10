import { PositionManager } from './glass/position-manager';
import { HTMLProcessor } from './glass/html-processor';
import { SVGProcessor } from './glass/svg-processor';
import { ImageProcessor } from './glass/image-processor';
import { ConfirmationButton } from './glass/confirmation-button';
import { FileLoader } from './glass/file-loader';
import { animarFase, normalizarTransicion, Transicion } from './glass/fx';
import { serviceRegistry } from '../services/registry';
import { IWindowVisibility } from '../services/interfaces';

/**
 * Get the window visibility service
 */
function getWindowVisibilityService(): IWindowVisibility {
  try {
    return serviceRegistry.get('windowVisibility') as IWindowVisibility
  } catch (error) {
    // Service not registered - this should not happen in production
    console.error('WindowVisibility service not available:', error)
    throw error
  }
}

// Basic Glass system implementation for TypeScript + Vue migration

// Glass class implementation compatible with review transactions
class Glass {
  public url: string
  private message: any
  public element: HTMLElement | null = null
  private durationTimeout: NodeJS.Timeout | null = null
  private positionKey: string | null = null
  private positionManager: PositionManager;
  public formResponse?: any;
  public confirmButton: any = null;
  public confirmationCounted: boolean = false;
  public isFinishing: boolean = false;
  public img: HTMLElement;
  public activeConnections: Map<string, WebSocket>;
  public wasConfirmed: boolean = false;
  // Lo bajaron desde el servidor (el mensaje se desactivo). No es un final normal: no
  // se avisa SUCCESS, porque no se llego a ver lo que el mensaje pedia.
  public retirado: boolean = false;
  /** Efectos de entrada y salida ya normalizados. Ver glass/fx/README.md. */
  private transicion: Transicion;
  /** El translate del ancla, al que los efectos le agregan lo suyo. */
  private transformBase: string = '';
  /** La opacidad con la que se queda el glass puesto: la transparencia del mensaje. */
  private opacidadFinal: number = 1;

  constructor(url: string | null, message: any) {
    this.url = url || ''
    this.message = message
    this.transicion = normalizarTransicion(message?.data?.transition);
    this.opacidadFinal = this._leerTransparencia(message?.data?.transparency);
    this.positionManager = new PositionManager();
    this.img = document.createElement('div'); // Crear un elemento temporal
    this.activeConnections = window.activeConnections || new Map();
    this.handleGlassDisplay()
  }

  /** La transparencia viaja como texto y puede no venir. Fuera de rango no significa nada. */
  private _leerTransparencia(valor: any): number {
    const numero = typeof valor === 'string' ? parseFloat(valor) : valor
    if (typeof numero !== 'number' || !isFinite(numero) || numero <= 0 || numero > 1) return 1
    return numero
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
        // El messageId y la instancia son lo que permite bajar un glass puesto cuando el
        // servidor avisa que el mensaje se desactivo: por posicion no se lo encuentra.
        messageId: this.message.data.messageId,
        glass: this,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Lo baja de la pantalla porque el mensaje dejo de estar activo, no porque haya
   * cumplido: sale igual que siempre —con su fundido— pero sin avisar SUCCESS.
   */
  public retirar(): void {
    this.retirado = true
    this.finishGlass()
  }

  private displayGlass(): void {
    this.initialize()
  }

  /**
   * El aviso sonoro. Suena cuando el mensaje YA esta en pantalla, no cuando se lo empieza
   * a armar: el contenido se carga (una imagen, un SVG, un html con sus fuentes) y en un
   * arte pesado eso tarda, con lo cual el sonido llegaba primero y se veia desincronizado.
   */
  private sonarAviso(): void {
    const soundSystem = serviceRegistry.get<any>('soundSystem');
    if (soundSystem && typeof soundSystem.playGlassSound === 'function') {
      soundSystem.playGlassSound();
    }
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
    const uploads = JSON.parse(data.uploads || '[]');
    const upload = uploads[0];

    // Sin archivo no hay nada que mostrar. Se corta aca: antes reventaba al pedirle el
    // mimetype a algo que no existe, y para entonces ya habia sonado el aviso. Tampoco se
    // avisa nada al servidor: mostrar la nada no es haber cumplido.
    if (!upload) {
      console.warn('Glass sin archivos, no hay nada que mostrar. id:', data.id)
      this.retirado = true
      this.cleanup()
      return
    }

    const processor = this._getContentProcessor(upload.mimetype, data);

    processor.process(glassContent, data, upload)
        .then(function() {
            // Finalizar configuración
            if (self.element) {
              self.element.appendChild(glassContent)
              document.body.appendChild(self.element)
              self.sonarAviso()
              self._finalizeGlassSetup(glassContent, data)
              self.animarEntrada(glassContent, data)
            }
        })
        .catch((e) => {
          console.error('Error processing content:', JSON.stringify(e));
          self.cleanup();
        });
  }

  private _finalizeGlassSetup(glassContent: HTMLElement, data: any): void {
    const askConfirmation = data.askConfirmation === true;
    const isForm = this._isFormContent(glassContent);

    // El reloj de duracion arranca aca y no al terminar la entrada: es lo que hacia el
    // fundido de siempre, y moverlo cambiaria la exposicion de todos los mensajes que ya
    // estan cargados.
    if (!askConfirmation && !isForm && data.duration) {
      this.durationTimeout = setTimeout(() => {
        this.finishGlass();
      }, data.duration * 1000);
    }
  }

  /**
   * El boton de confirmacion se coloca midiendo donde quedo el arte, y durante la entrada
   * el arte todavia se esta moviendo: puesto antes, la X queda clavada donde el glass
   * estaba a mitad de camino. Por eso se arma recien cuando la entrada termino.
   */
  private _armarBotonDeConfirmacion(data: any): void {
    if (this.isFinishing || !this.element) return;
    if (data.askConfirmation !== true) return;

    const position = JSON.parse(data.position || '{"h":1,"v":1}');
    this.confirmButton = new ConfirmationButton(this, position);
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
      // Arranca invisible y sigue invisible hasta que el motor de efectos toma el mando:
      // asi no se ve un cuadro del arte en su sitio antes de que empiece la entrada.
      opacity: '0',
      willChange: 'transform, opacity, filter, clip-path',
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
      // Los efectos escriben el transform entero, asi que necesitan el translate del
      // ancla para volver a ponerlo delante de lo suyo en cada cuadro.
      this.transformBase = this.positionManager.getPositionStyles(position).transform;
    } catch (error) {
      console.error('Error setting up positioning:', error);
      // Fallback to center positioning
      glassContent.style.left = '50%';
      glassContent.style.top = '50%';
      glassContent.style.transform = 'translate(-50%, -50%)';
      glassContent.style.transformOrigin = 'center center';
      this.transformBase = 'translate(-50%, -50%)';
    }
  }

  /**
   * La entrada.
   *
   * Espera a que el arte tenga medidas antes de arrancar: un `slide` necesita saber que
   * tan lejos esta el borde de la pantalla, y sobre un elemento de 0x0 el calculo daria
   * cualquier cosa. El aviso de `displayed` sale cuando la entrada termino de verdad, no
   * al segundo fijo de antes, porque ahora la entrada dura lo que diga el mensaje.
   */
  private animarEntrada(glassContent: HTMLElement, data: any): void {
    const arrancar = () => {
      if (this.isFinishing) return

      const contentRect = glassContent.getBoundingClientRect()
      if (contentRect.width <= 0 || contentRect.height <= 0) {
        requestAnimationFrame(arrancar)
        return
      }

      animarFase(glassContent, this.transicion.in, 'entrada', {
        transformBase: this.transformBase,
        opacidadFinal: this.opacidadFinal
      }).then(() => {
        if (this.isFinishing) return
        this._sendNotification('displayed')
        this._armarBotonDeConfirmacion(data)
      })
    }

    setTimeout(() => {
      requestAnimationFrame(arrancar)
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

    // Manejar botón de confirmación
    this._handleConfirmationButtonCleanup();

    if (!this.element) {
      this.cleanup();
      return;
    }
    
    const glassContent = this.element.querySelector('.glass-content') as HTMLElement
    if (!glassContent) {
      this.cleanup()
      return
    }

    // La entrada, si seguia corriendo, la corta el propio motor: mira antes donde estaba
    // el arte para que la salida siga desde ahi. Cortarla aca seria peor, porque entonces
    // lo que mediria es el estilo escrito —el de partida— y el arte pegaria un salto.
    animarFase(glassContent, this.transicion.out, 'salida', {
      transformBase: this.transformBase,
      opacidadFinal: this.opacidadFinal
    }).then(() => {
      this.cleanup()
    })
  }

  private _sendNotification(eventType: string, responseData?: any): void {
    const ws = this.activeConnections.get(this.url);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const glassId = this.message.data.id;
      const out = {
        event: 'notify',
        data: {
          id: glassId,
          event: eventType,
          response: responseData || {}
        }
      };
      ws.send(JSON.stringify(out));
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
    console.log('Glass cleanup called for glass ID:', this.message?.data?.id, 'positionKey:', this.positionKey);
    
    // Prepare response data for SUCCESS notification
    let responseData: any = {};
    if (this.formResponse) {
      // this.formResponse now contains the entire message from iframe
      // which includes response (form data) and timer/submit flags
      responseData.formData = this.formResponse.response;
      // Copy timer or submit flags if present
      if (this.formResponse.timer) {
        responseData.timer = true;
      }
      if (this.formResponse.submit) {
        responseData.submit = true;
      }
    }
    if (this.wasConfirmed) {
      responseData.confirmed = true;
    }
    
    // Send success notification before cleanup
    // Salvo que lo hayan bajado desde el servidor: eso no es haberlo cumplido.
    if (!this.retirado) {
      this._sendNotification('success', responseData)
    }
    
    // Remove from unified queue when glass finishes displaying
    if (window.removeFromUnifiedQueue && this.message && this.message.data) {
      if (this.message.data.messageId) {
        console.log('Removing from unified queue, messageId:', this.message.data.messageId);
        window.removeFromUnifiedQueue(this.message.data.messageId)
      } else if (this.message.data.id) {
        console.log('Removing from unified queue, id:', this.message.data.id.toString());
        window.removeFromUnifiedQueue(this.message.data.id.toString())
      }
    }

    // Cancel duration timeout
    if (this.durationTimeout) {
      clearTimeout(this.durationTimeout)
      this.durationTimeout = null
    }

    // Clean up confirmation button
    this._handleConfirmationButtonCleanup();

    // Clean up active position
    if (this.positionKey && window.activeGlasses) {
      console.log('Deleting from activeGlasses, positionKey:', this.positionKey, 'activeGlasses size before:', window.activeGlasses?.size);
      window.activeGlasses.delete(this.positionKey)
      console.log('activeGlasses size after:', window.activeGlasses?.size);
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
    this.wasConfirmed = false;
    this.retirado = false;

    // Check window visibility
    console.log('Glass cleanup: Calling checkWindowVisibility()');
    try {
      getWindowVisibilityService().checkWindowVisibility()
    } catch (error) {
      console.error('Failed to check window visibility:', error)
    }
  }
}

// Initialize global variables
window.activeGlasses = window.activeGlasses || new Map()

// Make classes globally available
window.Glass = Glass as any

// Duplicate message detection
window.isDuplicateMessage = function(messageId: string, _position: string): boolean {
  // Simple duplicate detection - check if same messageId is already in queue
  if (!window.unifiedGlassQueue) return false
  
  return window.unifiedGlassQueue.some((item: any) =>
    item.message.data.messageId === messageId
  )
}

// Window visibility checking is now handled by WindowVisibilityService
// No need to define a fallback on window object

// Export for use in other modules
export { Glass, FileLoader }