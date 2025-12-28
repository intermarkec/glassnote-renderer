import { MouseMoveButtonOptions } from './types';

export class MouseMoveButton {
  private button: HTMLElement;
  private clickHandler: (event: Event) => void;
  private normalColor: string;
  private hoverColor: string;

  constructor(options: MouseMoveButtonOptions) {
    this.button = options.button;
    this.clickHandler = options.clickHandler;
    this.normalColor = options.normalColor || '#e0e5ec';
    this.hoverColor = options.hoverColor || '#d1d9e6';
    
    this.setupBehavior();
  }

  private setupBehavior(): void {
    this.button.addEventListener('mouseover', () => this.handleMouseOver());
    this.button.addEventListener('mouseout', () => this.handleMouseOut());
    this.button.addEventListener('click', (event) => this.handleClick(event));
  }

  private handleMouseOver(): void {
    // NOTA: El passthrough se maneja a nivel de ventana en config-menu.ts
    // No enviar comandos de passthrough aquí

    const currentTransform = this.button.style.transform;
    this.button.style.transform = currentTransform.indexOf('translateX') !== -1
      ? 'translateX(-50%) scale(1.1)'
      : 'scale(1.1)';
    
    this.button.style.backgroundColor = this.hoverColor;
    
    if (this.button.style.boxShadow && this.button.style.boxShadow.includes('#b8bec7')) {
      this.button.style.boxShadow = '2px 2px 4px #b8bec7, -2px -2px 4px #ffffff';
    }
  }

  private handleMouseOut(): void {
    // NOTA: El passthrough se maneja a nivel de ventana en config-menu.ts
    // No enviar comandos de passthrough aquí

    const currentTransform = this.button.style.transform;
    this.button.style.transform = currentTransform.indexOf('translateX') !== -1
      ? 'translateX(-50%)'
      : 'none';
    
    this.button.style.backgroundColor = this.normalColor;
    
    if (this.button.dataset.view) {
      if (this.button.dataset.view === this.getCurrentView()) {
        this.button.style.boxShadow = 'inset 2px 2px 4px #5a5590, inset -2px -2px 4px #9c97c2';
      } else {
        this.button.style.boxShadow = '4px 4px 8px #b8bec7, -4px -4px 8px #ffffff';
      }
    } else if (this.button.dataset.action) {
      this.button.style.boxShadow = '8px 8px 16px #b8bec7, -8px -8px 16px #ffffff';
    }
  }
  
  private getCurrentView(): string {
    if (window._configMenuInstance) {
      return window._configMenuInstance.currentView;
    }
    return 'review';
  }

  private handleClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.clickHandler) {
      this.clickHandler(event);
    }
  }

  setColors(normalColor: string, hoverColor: string): void {
    this.normalColor = normalColor;
    this.hoverColor = hoverColor;
    this.button.style.backgroundColor = normalColor;
  }
}