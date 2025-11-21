export interface ConfigData {
  serverUrl?: string;
  serverName?: string;
  baseUrl?: string;
  position?: string;
  duration?: number;
  transparency?: string;
  needPresent?: boolean;
  askConfirmation?: boolean;
  isAsyncronous?: boolean;
  uploads?: string;
  parameters?: string;
}

export class ConfigView {
  private container: HTMLElement;
  private configData: ConfigData = {};
  private onChangeCallback?: (key: string, value: any) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setConfigData(configData: ConfigData): void {
    this.configData = { ...configData };
    this.render();
  }

  setOnChangeCallback(callback: (key: string, value: any) => void): void {
    this.onChangeCallback = callback;
  }

  render(): void {
    this.container.innerHTML = this.generateHTML();
    this.attachEventListeners();
  }

  private generateHTML(): string {
    return `
      <div class="config-section">
        ${this.generateServerConfigHTML()}
        ${this.generateDisplayConfigHTML()}
        ${this.generateBehaviorConfigHTML()}
        ${this.generateAdvancedConfigHTML()}
      </div>
    `;
  }

  private generateServerConfigHTML(): string {
    return `
      <div class="config-group">
        <h3 class="config-group-title">Configuración del Servidor</h3>
        <div class="config-item">
          <span class="config-label">URL del Servidor:</span>
          <input type="text" class="config-input" id="serverUrl" 
                 value="${this.configData.serverUrl || ''}" 
                 placeholder="https://ejemplo.com/api">
        </div>
        <div class="config-item">
          <span class="config-label">Nombre del Servidor:</span>
          <input type="text" class="config-input" id="serverName" 
                 value="${this.configData.serverName || ''}" 
                 placeholder="Mi Servidor">
        </div>
        <div class="config-item">
          <span class="config-label">URL Base:</span>
          <input type="text" class="config-input" id="baseUrl" 
                 value="${this.configData.baseUrl || ''}" 
                 placeholder="/api/v1">
        </div>
      </div>
    `;
  }

  private generateDisplayConfigHTML(): string {
    return `
      <div class="config-group">
        <h3 class="config-group-title">Configuración de Visualización</h3>
        <div class="config-item">
          <span class="config-label">Posición:</span>
          <select class="config-select" id="position">
            <option value="top-left" ${this.configData.position === 'top-left' ? 'selected' : ''}>Superior Izquierda</option>
            <option value="top-right" ${this.configData.position === 'top-right' ? 'selected' : ''}>Superior Derecha</option>
            <option value="bottom-left" ${this.configData.position === 'bottom-left' ? 'selected' : ''}>Inferior Izquierda</option>
            <option value="bottom-right" ${this.configData.position === 'bottom-right' ? 'selected' : ''}>Inferior Derecha</option>
            <option value="center" ${this.configData.position === 'center' ? 'selected' : ''}>Centro</option>
          </select>
        </div>
        <div class="config-item">
          <span class="config-label">Duración (ms):</span>
          <input type="number" class="config-input" id="duration" 
                 value="${this.configData.duration || 5000}" 
                 min="1000" max="30000" step="1000">
        </div>
        <div class="config-item">
          <span class="config-label">Transparencia:</span>
          <select class="config-select" id="transparency">
            <option value="opaque" ${this.configData.transparency === 'opaque' ? 'selected' : ''}>Opaco</option>
            <option value="semi-transparent" ${this.configData.transparency === 'semi-transparent' ? 'selected' : ''}>Semi-transparente</option>
            <option value="transparent" ${this.configData.transparency === 'transparent' ? 'selected' : ''}>Transparente</option>
          </select>
        </div>
      </div>
    `;
  }

  private generateBehaviorConfigHTML(): string {
    return `
      <div class="config-group">
        <h3 class="config-group-title">Comportamiento</h3>
        <div class="config-item">
          <span class="config-label">Necesita Presentación:</span>
          <input type="checkbox" class="config-checkbox" id="needPresent" 
                 ${this.configData.needPresent ? 'checked' : ''}>
        </div>
        <div class="config-item">
          <span class="config-label">Pedir Confirmación:</span>
          <input type="checkbox" class="config-checkbox" id="askConfirmation" 
                 ${this.configData.askConfirmation ? 'checked' : ''}>
        </div>
        <div class="config-item">
          <span class="config-label">Asíncrono:</span>
          <input type="checkbox" class="config-checkbox" id="isAsyncronous" 
                 ${this.configData.isAsyncronous ? 'checked' : ''}>
        </div>
      </div>
    `;
  }

  private generateAdvancedConfigHTML(): string {
    return `
      <div class="config-group">
        <h3 class="config-group-title">Configuración Avanzada</h3>
        <div class="config-item">
          <span class="config-label">Subidas:</span>
          <input type="text" class="config-input" id="uploads" 
                 value="${this.configData.uploads || ''}" 
                 placeholder="Configuración de subidas">
        </div>
        <div class="config-item">
          <span class="config-label">Parámetros:</span>
          <textarea class="config-textarea" id="parameters" 
                    placeholder="Parámetros adicionales en JSON">${this.configData.parameters || ''}</textarea>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const inputs = this.container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const key = target.id;
        let value: any;

        if (target.type === 'checkbox') {
          value = (target as HTMLInputElement).checked;
        } else if (target.type === 'number') {
          value = parseInt((target as HTMLInputElement).value, 10);
        } else {
          value = target.value;
        }

        if (this.onChangeCallback) {
          this.onChangeCallback(key, value);
        }
      });
    });
  }

  getConfigData(): ConfigData {
    const inputs = this.container.querySelectorAll('input, select, textarea');
    const config: ConfigData = {};

    inputs.forEach(input => {
      const target = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const key = target.id;
      let value: any;

      if (target.type === 'checkbox') {
        value = (target as HTMLInputElement).checked;
      } else if (target.type === 'number') {
        value = parseInt((target as HTMLInputElement).value, 10);
      } else {
        value = target.value;
      }

      config[key as keyof ConfigData] = value;
    });

    return config;
  }

  showLoading(): void {
    this.container.innerHTML = `
      <div class="loading-state">
        Cargando configuración...
      </div>
    `;
  }

  showError(message: string): void {
    this.container.innerHTML = `
      <div class="error-state">
        Error al cargar la configuración: ${message}
      </div>
    `;
  }
}