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
    this.button = document.createElement('button');
    this.button.className = 'confirmation-button';
    
    const scaleFactor = this.scaleCalculator.calculateScaleFactor();
    const baseSize = 50;
    const scaledSize = baseSize * scaleFactor;
    
    Object.assign(this.button.style, {
      position: 'fixed',
      width: scaledSize + 'px',
      height: scaledSize + 'px',
      borderRadius: (scaledSize / 2) + 'px',
      border: 'none',
      backgroundColor: '#7b76b9',
      cursor: 'pointer',
      boxShadow: '8px 8px 16px #b8bec7, -8px -8px 16px #ffffff',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      zIndex: '10002',
      pointerEvents: 'auto'
    });

    this._loadButtonIcon();
    this._setupPositioning();
    this._setupEventListeners();
    
    document.body.appendChild(this.button);
    this._enableTouchEvents();
  }

  private _loadButtonIcon(): void {
    const self = this;
    
    FileLoader.loadText('redcircle.svg')
      .then(function(svgContent: string) {
        self._processButtonSvg(svgContent);
      })
      .catch(function(error: Error) {
        console.error('Error loading redcircle.svg for confirmation button:', error);
        self._fallbackToTextButton();
      });
  }

  private _processButtonSvg(svgContent: string): void {
    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (svgElement) {
        const scaleFactor = this.scaleCalculator.calculateScaleFactor();
        const baseSvgSize = 30;
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
      console.error('Error parsing SVG content for confirmation button:', e);
      this._fallbackToTextButton();
    }
  }

  private _fallbackToTextButton(): void {
    Object.assign(this.button!.style, {
      color: 'white',
      fontSize: '24px',
      fontWeight: 'bold'
    });
    this.button!.textContent = '✓';
  }

  private _setupPositioning(): void {
    const scaleFactor = this.scaleCalculator.calculateScaleFactor();
    const buttonSize = 50 * scaleFactor;
    
    const positionContent = () => {
      const pos = this.positionManager.getPositionStrings(this.position);
      
      let left = '50%';
      let top = '50%';
      let transform = 'translate(-50%, -50%)';
      
      switch (pos.hOrigin) {
        case 'left':
          left = (buttonSize / 2 + 20) + 'px';
          transform = 'translateY(-50%)';
          break;
        case 'right':
          left = `calc(100% - ${buttonSize / 2 + 20}px)`;
          transform = 'translateY(-50%)';
          break;
      }
      
      switch (pos.vOrigin) {
        case 'top':
          top = (buttonSize / 2 + 20) + 'px';
          if (pos.hOrigin === 'center') {
            transform = 'translateX(-50%)';
          } else {
            transform = 'none';
          }
          break;
        case 'bottom':
          top = `calc(100% - ${buttonSize / 2 + 20}px)`;
          if (pos.hOrigin === 'center') {
            transform = 'translateX(-50%)';
          } else {
            transform = 'none';
          }
          break;
      }
      
      Object.assign(this.button!.style, {
        left: left,
        top: top,
        transform: transform
      });
    };

    positionContent();
    window.addEventListener('resize', positionContent);
  }

  private _setupEventListeners(): void {
    this.button!.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._handleConfirmation();
    });

    this.button!.addEventListener('mouseover', () => {
      this._handleMouseOver();
    });

    this.button!.addEventListener('mouseout', () => {
      this._handleMouseOut();
    });
  }

  private _handleConfirmation(): void {
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

  private _handleMouseOver(): void {
    if (this.button) {
      this.button.style.backgroundColor = '#6a659f';
      this.button.style.boxShadow = '4px 4px 8px #b8bec7, -4px -4px 8px #ffffff';
      this.button.style.transform = this.button.style.transform.replace('scale(1)', 'scale(1.1)');
    }
    
    try {
      if (window.electronAPI && !window.AndroidBridge) {
        window.electronAPI.send('set-ignore-events-false');
      }
    } catch (e) {
      console.error('Not in Electron environment');
    }
  }

  private _handleMouseOut(): void {
    if (this.button) {
      this.button.style.backgroundColor = '#7b76b9';
      this.button.style.boxShadow = '8px 8px 16px #b8bec7, -8px -8px 16px #ffffff';
      this.button.style.transform = this.button.style.transform.replace('scale(1.1)', 'scale(1)');
    }
    
    try {
      if (window.electronAPI && !window.AndroidBridge) {
        window.electronAPI.send('set-ignore-events-true');
      }
    } catch (e) {
      console.error('Not in Electron environment');
    }
  }

  private _enableTouchEvents(): void {
    try {
      if (window.AndroidBridge) {
        window.activeConfirmationGlasses = window.activeConfirmationGlasses || 0;
        window.activeConfirmationGlasses++;
        window.AndroidBridge.setIgnoreEventsFalse();
      } else if (window.electronAPI) {
        window.electronAPI.send('set-ignore-events-false');
      }
    } catch (e) {
      console.error('Error enabling touch events:', e);
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