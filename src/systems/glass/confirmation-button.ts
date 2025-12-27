import { ScaleCalculator } from './scale-calculator';
import { PositionManager, Position } from './position-manager';
import { FileLoader } from './file-loader';

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
        window.AndroidBridge.setIgnoreEventsFalse();
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
    const self = this;
    
    FileLoader.loadText('xbutton.svg')
      .then(function(svgContent: string) {
        self._processSvgContent(svgContent);
      })
      .catch(function(error: Error) {
        console.error('Error loading xbutton.svg:', error);
        self._fallbackToTextButton();
      });
  }

  private _processSvgContent(svgContent: string): void {
    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (svgElement) {
        const scaleFactor = this.scaleCalculator.calculateScaleFactor();
        const baseSvgSize = 34;
        const scaledSvgSize = baseSvgSize * scaleFactor;
        
        Object.assign(svgElement.style, {
          width: scaledSvgSize + 'px',
          height: scaledSvgSize + 'px',
          fill: 'white',
          display: 'block'
        });
        
        this.button!.innerHTML = '';
        this.button!.appendChild(svgElement);
      } else {
        throw new Error('No SVG element found');
      }
    } catch (e) {
      console.error('Error parsing SVG content:', e);
      this._fallbackToTextButton();
    }
  }

  private _fallbackToTextButton(): void {
    Object.assign(this.button!.style, {
      color: 'white',
      fontSize: '24px',
      fontWeight: 'bold'
    });
    this.button!.textContent = '✕';
  }

  private _positionButton(): void {
    const self = this;
    
    const positionButton = () => {
      const glassContent = this.glass.img.querySelector('.glass-content');
      if (!glassContent) {
        requestAnimationFrame(positionButton);
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
        requestAnimationFrame(positionButton);
        return;
      }

      // Aplicar estilos de posicionamiento
      Object.assign(this.button!.style, buttonStyles);
    };

    requestAnimationFrame(positionButton);
  }

  private _setupEventListeners(): void {
    const self = this;

    // Hover effects para desktop
    this.button!.addEventListener('mouseover', function() {
      self._handleMouseOver();
    });

    this.button!.addEventListener('mouseout', function() {
      self._handleMouseOut();
    });

    // Click handler
    this.button!.addEventListener('click', function() {
      self._handleClick();
    });
  }

  private _handleMouseOver(): void {
    try {
      if (window.electronAPI) {
        window.electronAPI.send('set-ignore-events-false');
      }
    } catch (e) {
      console.error('Not in Electron environment');
    }

    // Efecto hover simple - solo escala
    const currentTransform = this.button!.style.transform;
    this.button!.style.transform = currentTransform.indexOf('translateX') !== -1
      ? 'translateX(-50%) scale(1.1)'
      : 'scale(1.1)';
    this.button!.style.backgroundColor = '#6a659f'; // Morado más oscuro en hover
    this.button!.style.boxShadow = 'none'; // Sin glow
  }

  private _handleMouseOut(): void {
    try {
      if (window.electronAPI) {
        window.electronAPI.send('set-ignore-events-true');
      }
    } catch (e) {
      console.error('Not in Electron environment');
    }

    // Remover efectos hover
    const currentTransform = this.button!.style.transform;
    this.button!.style.transform = currentTransform.indexOf('translateX') !== -1
      ? 'translateX(-50%)'
      : 'none';
    this.button!.style.backgroundColor = '#7b76b9'; // Volver al morado original
    this.button!.style.boxShadow = 'none'; // Sin glow
  }

  private _handleClick(): void {
    // Deshabilitar botón inmediatamente
    this.button!.disabled = true;
    this.button!.style.opacity = '0.5';
    this.button!.style.cursor = 'default';
    
    this._sendConfirmationResponse();
    this.glass.finishGlass();
  }

  private _sendConfirmationResponse(): void {
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
            window.AndroidBridge.setIgnoreEventsTrue();
          }
        }
      } else if (window.electronAPI) {
        window.electronAPI.send('set-ignore-events-true');
      }
    } catch (e) {
      console.error('Error disabling touch events:', e);
    }
  }
}

window.ConfirmationButton = ConfirmationButton;