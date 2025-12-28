import { ScaleCalculator } from './scale-calculator';
import { PositionManager, Position } from './position-manager';

interface GlassInstance {
  finishGlass: () => void;
  cleanup: () => void;
  confirmationCounted: boolean;
  url: string;
  activeConnections: Map<string, WebSocket>;
  img: HTMLElement;
}

export class ConfirmationButton {
  private glass: GlassInstance;
  private position: Position;
  private scaleCalculator: ScaleCalculator;
  private positionManager: PositionManager;
  private button: HTMLButtonElement | null = null;
  private buttonHandler: any = null;
  private isDestroyed: boolean = false;
  private animationFrameId: number | null = null;

  constructor(glassInstance: GlassInstance, position: Position) {
    this.glass = glassInstance;
    this.position = position;
    this.scaleCalculator = new ScaleCalculator();
    this.positionManager = new PositionManager();
    this.create();
  }

  create(): void {
    this._handleAndroidTouch();
    this._createButton();
    this._loadIcon();
    this._setupEventListeners();
    this._positionButton();
    
    if (this.button) {
      document.body.appendChild(this.button);
    }
  }

  private _handleAndroidTouch(): void {
    try {
      if (window.AndroidBridge) {
        window.activeConfirmationGlasses = window.activeConfirmationGlasses || 0;
        window.activeConfirmationGlasses++;
        this.glass.confirmationCounted = true;
        // Use centralized passthrough manager if available
        if (window.passthroughManager) {
          window.passthroughManager.setPassthrough(false);
        } else {
          window.AndroidBridge.setIgnoreEventsFalse();
        }
      }
    } catch (e) {
      console.error('Not in Android environment');
      this.glass.confirmationCounted = false;
    }
  }

  private _createButton(): void {
    const scaleFactor = this.scaleCalculator.calculateScaleFactor();
    const baseSize = 50;
    const scaledSize = baseSize * scaleFactor;
    
    this.button = document.createElement('button');
    this.button.className = 'glass-confirm-button';
    
    // Estilos base - sin glow, color morado
    Object.assign(this.button.style, {
      position: 'absolute',
      zIndex: '10000',
      width: scaledSize + 'px',
      height: scaledSize + 'px',
      borderRadius: (scaledSize / 2) + 'px',
      border: 'none',
      backgroundColor: '#7b76b9', // Color morado
      cursor: 'pointer',
      boxShadow: 'none', // Sin glow
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0'
    });

    // Estilos específicos para móvil
    if (this.scaleCalculator.isMobile()) {
      Object.assign(this.button.style, {
        minWidth: '44px',
        minHeight: '44px',
        touchAction: 'manipulation',
        webkitTapHighlightColor: 'transparent',
        zIndex: '10001' // Mayor z-index para móvil
      });
    }
  }

  private _loadIcon(): void {
    if (this.isDestroyed || !this.button) {
      return;
    }
    
    try {
      const scaleFactor = this.scaleCalculator.calculateScaleFactor();
      const baseSvgSize = 34;
      const scaledSvgSize = baseSvgSize * scaleFactor;
      
      // Crear elemento img para cargar el SVG
      const img = document.createElement('img');
      img.src = './xbutton.svg'; // Ruta relativa desde la página actual
      img.alt = 'X';
      
      Object.assign(img.style, {
        width: scaledSvgSize + 'px',
        height: scaledSvgSize + 'px',
        display: 'block',
        pointerEvents: 'none', // Para que no interfiera con los clicks del botón
        filter: 'brightness(0) invert(1)' // Hace el SVG blanco (invierte colores y ajusta brillo)
      });
      
      this.button.innerHTML = '';
      this.button.appendChild(img);
      
      // Manejar error de carga
      img.onerror = () => {
        if (this.isDestroyed) {
          return;
        }
        console.error('Failed to load xbutton.svg');
        this._fallbackToTextButton();
      };
    } catch (error) {
      if (this.isDestroyed) {
        return;
      }
      console.error('Error creating SVG image:', error);
      this._fallbackToTextButton();
    }
  }

  private _fallbackToTextButton(): void {
    if (this.isDestroyed) {
      return;
    }
    
    if (!this.button) {
      console.error('Button is null in _fallbackToTextButton');
      return;
    }
    Object.assign(this.button.style, {
      color: 'white',
      fontSize: '24px',
      fontWeight: 'bold'
    });
    this.button.textContent = '✕';
  }

  private _positionButton(): void {
    const self = this;
    
    const positionButton = () => {
      if (this.isDestroyed) {
        return;
      }
      
      if (!this.button) {
        console.error('Button is null in _positionButton');
        return;
      }
      
      const glassContent = this.glass.img.querySelector('.glass-content');
      if (!glassContent) {
        this.animationFrameId = requestAnimationFrame(positionButton);
        return;
      }

      const scaleFactor = this.scaleCalculator.calculateScaleFactor();
      const buttonSize = 50 * scaleFactor;
      
      const buttonStyles = this.positionManager.calculateButtonPosition(
        glassContent as HTMLElement,
        this.position,
        buttonSize,
        scaleFactor
      );

      if (!buttonStyles) {
        this.animationFrameId = requestAnimationFrame(positionButton);
        return;
      }

      // Aplicar estilos de posicionamiento
      Object.assign(this.button.style, buttonStyles);
      this.animationFrameId = null;
    };

    this.animationFrameId = requestAnimationFrame(positionButton);
  }

  private _setupEventListeners(): void {
    const self = this;

    if (!this.button) {
      console.error('Button is null in _setupEventListeners');
      return;
    }

    // Hover effects para desktop
    this.button.addEventListener('mouseover', function() {
      self._handleMouseOver();
    });

    this.button.addEventListener('mouseout', function() {
      self._handleMouseOut();
    });

    // Click handler
    this.button.addEventListener('click', function() {
      self._handleClick();
    });
  }

  private _handleMouseOver(): void {
    if (this.isDestroyed) {
      return;
    }
    
    if (!this.button) {
      console.error('Button is null in _handleMouseOver');
      return;
    }
    
    try {
      // Use centralized passthrough manager if available
      if (window.passthroughManager) {
        window.passthroughManager.setPassthrough(false);
      } else if (window.electronAPI) {
        // Fallback to direct electron API
        window.electronAPI.send('set-ignore-events-false');
      }
    } catch (e) {
      console.error('Not in Electron environment');
    }

    // Efecto hover simple - solo escala
    const currentTransform = this.button.style.transform;
    this.button.style.transform = currentTransform.indexOf('translateX') !== -1
      ? 'translateX(-50%) scale(1.1)'
      : 'scale(1.1)';
    this.button.style.backgroundColor = '#6a659f'; // Morado más oscuro en hover
    this.button.style.boxShadow = 'none'; // Sin glow
  }

  private _handleMouseOut(): void {
    if (this.isDestroyed) {
      return;
    }
    
    if (!this.button) {
      console.error('Button is null in _handleMouseOut');
      return;
    }
    
    try {
      // Use centralized passthrough manager if available
      if (window.passthroughManager) {
        window.passthroughManager.setPassthrough(true);
      } else if (window.electronAPI) {
        // Fallback to direct electron API
        window.electronAPI.send('set-ignore-events-true');
      }
    } catch (e) {
      console.error('Not in Electron environment');
    }

    // Remover efectos hover
    const currentTransform = this.button.style.transform;
    this.button.style.transform = currentTransform.indexOf('translateX') !== -1
      ? 'translateX(-50%)'
      : 'none';
    this.button.style.backgroundColor = '#7b76b9'; // Volver al morado original
    this.button.style.boxShadow = 'none'; // Sin glow
  }

  private _handleClick(): void {
    if (this.isDestroyed) {
      return;
    }
    
    if (!this.button) {
      console.error('Button is null in _handleClick');
      return;
    }
    
    // Deshabilitar botón inmediatamente
    this.button.disabled = true;
    this.button.style.opacity = '0.5';
    this.button.style.cursor = 'default';
    
    this._sendConfirmationResponse();
    this.glass.finishGlass();
  }

  private _sendConfirmationResponse(): void {
    if (this.isDestroyed) {
      return;
    }
    
    const ws = this.glass.activeConnections.get(this.glass.url);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const glassId = (this.glass.img as any).glass_id;
      const out = {
        event: 'notify',
        data: {
          id: glassId,
          event: 'success',
          response: { confirmed: true }
        }
      };
      ws.send(JSON.stringify(out));
    }
  }

  cleanup(): void {
    this.isDestroyed = true;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.button && this.button.parentNode) {
      document.body.removeChild(this.button);
    }
    
    this._disableTouchEvents();
    
    this.button = null;
    this.buttonHandler = null;
  }

  private _disableTouchEvents(): void {
    try {
      if (window.AndroidBridge) {
        if (!this.glass.confirmationCounted) {
          window.activeConfirmationGlasses = window.activeConfirmationGlasses || 0;
          if (window.activeConfirmationGlasses > 0) {
            window.activeConfirmationGlasses--;
          }
          this.glass.confirmationCounted = true;
          if (window.activeConfirmationGlasses === 0) {
            // Use centralized passthrough manager if available
            if (window.passthroughManager) {
              window.passthroughManager.setPassthrough(true);
            } else {
              window.AndroidBridge.setIgnoreEventsTrue();
            }
          }
        }
      } else if (window.electronAPI) {
        // Use centralized passthrough manager if available
        if (window.passthroughManager) {
          window.passthroughManager.setPassthrough(true);
        } else {
          window.electronAPI.send('set-ignore-events-true');
        }
      }
    } catch (e) {
      console.error('Error disabling touch events:', e);
    }
  }
}

window.ConfirmationButton = ConfirmationButton;