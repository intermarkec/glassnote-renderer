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
  private _configData: ConfigData = {};
  private onChangeCallback?: (key: string, value: any) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setConfigData(configData: ConfigData): void {
    this._configData = { ...configData };
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
        <h2 class="config-title">Configuración</h2>
        <div class="config-buttons">
          <button class="config-button" data-action="request-code">Solicitar Código</button>
          <button class="config-button" data-action="hide-code">Ocultar Código</button>
          <button class="config-button" data-action="register">Registrar</button>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const buttons = this.container.querySelectorAll('.config-button');
    buttons.forEach(button => {
      button.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const action = target.dataset.action;
        if (action && this.onChangeCallback) {
          this.onChangeCallback(action, true);
        }
      });
    });
  }

  getConfigData(): ConfigData {
    // No hay campos de configuración en esta vista simplificada
    return {};
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