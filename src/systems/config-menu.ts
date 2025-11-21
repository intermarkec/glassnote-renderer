import { UserDataManager } from './user-data-manager';

export interface ConfigMenuOptions {
  container?: HTMLElement;
  position?: { x: number; y: number };
  onClose?: () => void;
  onConfigChange?: (config: any) => void;
}

export class ConfigMenu {
  private container: HTMLElement;
  private menuElement: HTMLElement | null = null;
  private isOpen = false;
  private onClose?: () => void;
  private onConfigChange?: (config: any) => void;
  private userDataManager: UserDataManager;

  constructor(options: ConfigMenuOptions = {}) {
    this.container = options.container || document.body;
    this.onClose = options.onClose;
    this.onConfigChange = options.onConfigChange;
    this.userDataManager = new UserDataManager();
    
    this.initialize();
  }

  private initialize(): void {
    this.createMenuElement();
    this.setupEventListeners();
  }

  private createMenuElement(): void {
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'config-menu';
    this.menuElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #333;
      border-radius: 10px;
      padding: 20px;
      z-index: 10000;
      min-width: 300px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: none;
    `;

    this.menuElement.innerHTML = `
      <div class="config-header" style="margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
        <h3 style="margin: 0; color: #333;">Configuración</h3>
      </div>
      
      <div class="config-section" style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Sonido:</label>
        <select id="sound-enabled" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
          <option value="true">Activado</option>
          <option value="false">Desactivado</option>
        </select>
      </div>

      <div class="config-section" style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Posición de notas:</label>
        <select id="note-position" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
          <option value="random">Aleatoria</option>
          <option value="top-left">Superior Izquierda</option>
          <option value="top-center">Superior Centro</option>
          <option value="top-right">Superior Derecha</option>
          <option value="center-left">Centro Izquierda</option>
          <option value="center">Centro</option>
          <option value="center-right">Centro Derecha</option>
          <option value="bottom-left">Inferior Izquierda</option>
          <option value="bottom-center">Inferior Centro</option>
          <option value="bottom-right">Inferior Derecha</option>
        </select>
      </div>

      <div class="config-section" style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tamaño de notas:</label>
        <select id="note-size" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
          <option value="small">Pequeño</option>
          <option value="medium">Mediano</option>
          <option value="large">Grande</option>
        </select>
      </div>

      <div class="config-section" style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Transparencia:</label>
        <input type="range" id="transparency" min="0.1" max="1" step="0.1" value="0.9"
               style="width: 100%;" />
        <span id="transparency-value" style="font-size: 12px; color: #666;">90%</span>
      </div>

      <div class="config-section" style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tiempo de desaparición (segundos):</label>
        <input type="number" id="disappear-time" min="1" max="60" value="10"
               style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;" />
      </div>

      <div class="config-buttons" style="display: flex; justify-content: space-between;">
        <button id="save-config" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Guardar
        </button>
        <button id="close-config" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Cerrar
        </button>
      </div>
    `;

    this.container.appendChild(this.menuElement);
    this.setupMenuEventListeners();
  }

  private setupMenuEventListeners(): void {
    if (!this.menuElement) return;

    const transparencySlider = this.menuElement.querySelector('#transparency') as HTMLInputElement;
    const transparencyValue = this.menuElement.querySelector('#transparency-value') as HTMLElement;
    
    if (transparencySlider && transparencyValue) {
      transparencySlider.addEventListener('input', () => {
        transparencyValue.textContent = `${Math.round(parseFloat(transparencySlider.value) * 100)}%`;
      });
    }

    const saveButton = this.menuElement.querySelector('#save-config') as HTMLButtonElement;
    const closeButton = this.menuElement.querySelector('#close-config') as HTMLButtonElement;

    if (saveButton) {
      saveButton.addEventListener('click', () => this.saveConfig());
    }

    if (closeButton) {
      closeButton.addEventListener('click', () => this.close());
    }
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    document.addEventListener('click', (event) => {
      if (this.isOpen && this.menuElement && !this.menuElement.contains(event.target as Node)) {
        this.close();
      }
    });
  }

  private async saveConfig(): Promise<void> {
    if (!this.menuElement) return;

    const soundEnabled = (this.menuElement.querySelector('#sound-enabled') as HTMLSelectElement).value === 'true';
    const notePosition = (this.menuElement.querySelector('#note-position') as HTMLSelectElement).value;
    const noteSize = (this.menuElement.querySelector('#note-size') as HTMLSelectElement).value;
    const transparency = parseFloat((this.menuElement.querySelector('#transparency') as HTMLInputElement).value);
    const disappearTime = parseInt((this.menuElement.querySelector('#disappear-time') as HTMLInputElement).value);

    const config = {
      soundEnabled,
      notePosition,
      noteSize,
      transparency,
      disappearTime
    };

    await this.userDataManager.setConfig(config);
    
    if (this.onConfigChange) {
      this.onConfigChange(config);
    }

    this.close();
  }

  async open(): Promise<void> {
    if (this.menuElement) {
      const config = await this.userDataManager.getConfig();
      
      const soundEnabledSelect = this.menuElement.querySelector('#sound-enabled') as HTMLSelectElement;
      const notePositionSelect = this.menuElement.querySelector('#note-position') as HTMLSelectElement;
      const noteSizeSelect = this.menuElement.querySelector('#note-size') as HTMLSelectElement;
      const transparencySlider = this.menuElement.querySelector('#transparency') as HTMLInputElement;
      const transparencyValue = this.menuElement.querySelector('#transparency-value') as HTMLElement;
      const disappearTimeInput = this.menuElement.querySelector('#disappear-time') as HTMLInputElement;
      
      if (soundEnabledSelect) {
        soundEnabledSelect.value = config.soundEnabled ? 'true' : 'false';
      }
      
      if (notePositionSelect) {
        notePositionSelect.value = config.notePosition || 'random';
      }
      
      if (noteSizeSelect) {
        noteSizeSelect.value = config.noteSize || 'medium';
      }
      
      if (transparencySlider) {
        transparencySlider.value = String(config.transparency || 0.9);
      }
      
      if (transparencyValue) {
        transparencyValue.textContent = `${Math.round((config.transparency || 0.9) * 100)}%`;
      }
      
      if (disappearTimeInput) {
        disappearTimeInput.value = String(config.disappearTime || 10);
      }
      
      this.menuElement.style.display = 'block';
      this.isOpen = true;
    }
  }

  close(): void {
    if (this.menuElement) {
      this.menuElement.style.display = 'none';
      this.isOpen = false;
      
      if (this.onClose) {
        this.onClose();
      }
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  isMenuOpen(): boolean {
    return this.isOpen;
  }

  destroy(): void {
    if (this.menuElement && this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
    }
    this.menuElement = null;
    this.isOpen = false;
  }
}

// Make ConfigMenu globally available
window.ConfigMenu = ConfigMenu as any;

export default ConfigMenu;