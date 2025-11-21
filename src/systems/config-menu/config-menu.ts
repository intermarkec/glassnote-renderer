import { MouseMoveButton } from './mouse-move-button';
import { ReviewView } from './views/review-view';
import { ConfigView, ConfigData } from './views/config-view';
import { configMenuStyles } from './styles/config-menu-styles';
import { Transaction, PendingRequest, ReviewTransaction } from './types';

// Global function to toggle config menu (similar to original implementation)
export function toggleConfigMenu(view?: string): void {
  if (!window._configMenuInstance) {
    if (typeof window.ConfigMenu === 'function') {
      window._configMenuInstance = new window.ConfigMenu();
    } else {
      console.error('ConfigMenu class not available');
      return;
    }
  }
  
  if (window._configMenuInstance && window._configMenuInstance.isVisible) {
    window._configMenuInstance.hide();
  } else if (window._configMenuInstance) {
    if (view && (view === 'review' || view === 'config')) {
      window._configMenuInstance.switchView(view);
    }
    window._configMenuInstance.show();
  }
}

export class ConfigMenu {
  private container: HTMLElement;
  public isVisible: boolean = false;
  private currentView: string = 'review';
  private reviewView: ReviewView;
  private configView: ConfigView;
  private transactions: Transaction[] = [];
  private pendingRequests: PendingRequest[] = [];
  private configData: ConfigData = {};
  
  // Review system properties
  private pendingRequestsMap: Map<string, {serverUrl: string, timestamp: number, requestId: string}> = new Map();
  private accumulatedTransactions: Map<string, ReviewTransaction[]> = new Map();
  private currentRequestId: string | null = null;

  constructor() {
    console.log('ConfigMenu: Constructor called');
    this.container = document.createElement('div');
    this.container.className = 'config-menu';
    this.container.style.display = 'none';
    
    this.reviewView = new ReviewView(document.createElement('div'));
    this.configView = new ConfigView(document.createElement('div'));
    
    this.setupStyles();
    this.setupEventListeners();
    this.setupWebSocketListener();
    
    console.log('ConfigMenu: Initialization complete, global handler set:', !!window._handleWebSocketMessage);
  }

  private setupStyles(): void {
    const styleElement = document.createElement('style');
    styleElement.textContent = configMenuStyles;
    document.head.appendChild(styleElement);
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  async show(): Promise<void> {
    if (this.isVisible) return;
    
    this.container.innerHTML = this.generateHTML();
    document.body.appendChild(this.container);
    this.container.style.display = 'flex';
    this.isVisible = true;
    
    // Disable mouse event passthrough when config menu is open
    this.setIgnoreMouseEvents(false);
    
    this.initializeViews();
    this.attachEventListeners();
    await this.loadData();
    
    // Request transactions when showing the menu in review view
    if (this.currentView === 'review') {
      this.requestTransactions();
    }
  }

  hide(): void {
    if (!this.isVisible) return;
    
    this.container.style.display = 'none';
    this.container.remove();
    this.isVisible = false;
    
    // Re-enable mouse event passthrough when config menu is closed
    this.setIgnoreMouseEvents(true);
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  private generateHTML(): string {
    return `
      <div class="config-menu-container">
        <div class="config-menu-header">
          <h2 class="config-menu-title">Configuración</h2>
          <button class="close-button" data-action="close">×</button>
        </div>
        
        <div class="config-menu-content">
          <div class="view-buttons">
            <button class="view-button ${this.currentView === 'review' ? 'active' : ''}" 
                    data-view="review">Revisión</button>
            <button class="view-button ${this.currentView === 'config' ? 'active' : ''}" 
                    data-view="config">Configuración</button>
          </div>
          
          <div class="view-content" id="viewContent">
            <!-- Content will be populated by views -->
          </div>
          
          <div class="action-buttons">
            <button class="action-button primary" data-action="save">Guardar</button>
            <button class="action-button" data-action="cancel">Cancelar</button>
          </div>
        </div>
      </div>
    `;
  }

  private initializeViews(): void {
    const viewContent = this.container.querySelector('#viewContent') as HTMLElement;
    if (!viewContent) return;

    if (this.currentView === 'review') {
      this.reviewView = new ReviewView(viewContent);
      this.reviewView.setTransactions(this.transactions);
      this.reviewView.setPendingRequests(this.pendingRequests);
      this.reviewView.setOnPlayTransaction((transaction) => {
        this.handlePlayTransaction(transaction);
      });
    } else {
      this.configView = new ConfigView(viewContent);
      this.configView.setConfigData(this.configData);
      this.configView.setOnChangeCallback((key, value) => {
        this.configData[key as keyof ConfigData] = value;
      });
    }
  }

  private attachEventListeners(): void {
    const closeButton = this.container.querySelector('[data-action="close"]');
    const viewButtons = this.container.querySelectorAll('[data-view]');
    const actionButtons = this.container.querySelectorAll('[data-action]');

    if (closeButton) {
      new MouseMoveButton({
        button: closeButton as HTMLElement,
        clickHandler: () => this.hide()
      });
    }

    viewButtons.forEach(button => {
      new MouseMoveButton({
        button: button as HTMLElement,
        clickHandler: (event) => {
          const target = event.target as HTMLElement;
          const view = target.dataset.view;
          if (view) {
            this.switchView(view);
          }
        }
      });
    });

    actionButtons.forEach(button => {
      const action = (button as HTMLElement).dataset.action;
      if (action && action !== 'close') {
        new MouseMoveButton({
          button: button as HTMLElement,
          clickHandler: () => this.handleAction(action)
        });
      }
    });
  }

  public switchView(view: string): void {
    if (this.currentView === view) return;
    
    this.currentView = view;
    
    const viewButtons = this.container.querySelectorAll('[data-view]');
    viewButtons.forEach(button => {
      const buttonView = (button as HTMLElement).dataset.view;
      if (buttonView === view) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    this.initializeViews();
    
    // Request transactions when switching to review view
    if (view === 'review' && this.isVisible) {
      this.requestTransactions();
    }
  }

  private handleAction(action: string): void {
    switch (action) {
      case 'save':
        this.saveConfig();
        break;
      case 'cancel':
        this.hide();
        break;
    }
  }

  private async loadData(): Promise<void> {
    this.loadTransactions();
    this.loadPendingRequests();
    await this.loadConfigData();
  }

  private loadTransactions(): void {
    try {
      // For now, use empty transactions since UserDataManager doesn't have this method
      this.transactions = [];
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.transactions = [];
    }
  }

  private loadPendingRequests(): void {
    try {
      // For now, use empty pending requests since UserDataManager doesn't have this method
      this.pendingRequests = [];
    } catch (error) {
      console.error('Error loading pending requests:', error);
      this.pendingRequests = [];
    }
  }

  private async loadConfigData(): Promise<void> {
    try {
      if (window.userDataManager) {
        const config = await window.userDataManager.getConfig();
        this.configData = config || {};
      } else {
        this.configData = {};
      }
    } catch (error) {
      console.error('Error loading config data:', error);
      this.configData = {};
    }
  }

  private saveConfig(): void {
    try {
      if (this.currentView === 'config') {
        const updatedConfig = this.configView.getConfigData();
        this.configData = { ...this.configData, ...updatedConfig };
      }

      // Save config using available APIs
      if (window.electronAPI) {
        window.electronAPI.send('save-config', this.configData);
      } else if (window.userDataManager) {
        window.userDataManager.setConfig(this.configData);
      }

      this.hide();
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  setTransactions(transactions: Transaction[]): void {
    this.transactions = transactions;
    if (this.isVisible && this.currentView === 'review') {
      this.reviewView.setTransactions(transactions);
    }
  }

  setPendingRequests(pendingRequests: PendingRequest[]): void {
    this.pendingRequests = pendingRequests;
    if (this.isVisible && this.currentView === 'review') {
      this.reviewView.setPendingRequests(pendingRequests);
    }
  }

  setConfigData(configData: ConfigData): void {
    this.configData = configData;
    if (this.isVisible && this.currentView === 'config') {
      this.configView.setConfigData(configData);
    }
  }

  isOpen(): boolean {
    return this.isVisible;
  }
  
    private setupWebSocketListener(): void {
      const originalHandleWebSocketMessage = window._handleWebSocketMessage || null;
      
      console.log('ConfigMenu: Setting up WebSocket listener, original handler exists:', !!originalHandleWebSocketMessage);
      
      if (originalHandleWebSocketMessage) {
        window._originalHandleWebSocketMessage = originalHandleWebSocketMessage;
      }
      
      window._handleWebSocketMessage = async (url: string, event: MessageEvent) => {
        console.log('ConfigMenu: WebSocket message handler called for URL:', url);
        
        try {
          const message = JSON.parse(event.data);
          console.log('ConfigMenu: Received WebSocket message:', message.event, 'from', url);
          
          // Only process review messages when the config menu is open and in review view
          if (message.event === 'review' && Array.isArray(message.data) &&
              this.isVisible && this.currentView === 'review') {
            
            console.log('ConfigMenu: Processing review response with', message.data.length, 'transactions from', url);
            
            const transactionsWithServer = message.data.map((transaction: any) => ({
              ...transaction,
              serverUrl: url,
              serverName: this.getServerName(url),
              name: transaction.messageName || this.extractNameFromUploads(transaction.uploads),
              description: transaction.messageDescription || this.extractDescriptionFromUploads(transaction.uploads)
            }));
            
            this.accumulateTransactions(url, transactionsWithServer);
            this.pendingRequestsMap.delete(url);
            
            console.log('ConfigMenu: Remaining pending requests:', this.pendingRequestsMap.size);
            
            if (this.pendingRequestsMap.size === 0) {
              console.log('ConfigMenu: All responses received, displaying accumulated transactions');
              this.displayAccumulatedTransactions();
            }
          } else {
            // For non-review messages, just log - the WebSocket manager will handle them
            console.log('ConfigMenu: Ignoring non-review message:', message.event);
          }
        } catch (error) {
          console.error('ConfigMenu: Error processing message:', error);
        }
      };
      
      // Reconfigure existing WebSocket connections to use the global handler
      this.reconfigureExistingWebSockets();
    }
    
    private reconfigureExistingWebSockets(): void {
      if (window.activeConnections && window.activeConnections.size > 0) {
        console.log('ConfigMenu: Reconfiguring existing WebSocket connections to use global handler');
        window.activeConnections.forEach((ws, url) => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log('ConfigMenu: Reconfiguring WebSocket for URL:', url);
            ws.onmessage = (event: MessageEvent) => {
              if (window._handleWebSocketMessage) {
                window._handleWebSocketMessage(url, event);
              }
            };
          }
        });
      }
    }
  
    private requestTransactions(): void {
      this.currentRequestId = 'review_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      this.pendingRequestsMap.clear();
      this.accumulatedTransactions.clear();
      
      const message = {
        event: 'review',
        data: {
          limit: 10,
          requestId: this.currentRequestId
        }
      };
      
      console.log('ConfigMenu: Requesting transactions from all servers, requestId:', this.currentRequestId);
      
      if (window.activeConnections && window.activeConnections.size > 0) {
        let requestsSent = 0;
        window.activeConnections.forEach((ws, url) => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log('ConfigMenu: Sending review request to:', url);
            ws.send(JSON.stringify(message));
            this.pendingRequestsMap.set(url, {
              serverUrl: url,
              timestamp: Date.now(),
              requestId: this.currentRequestId!
            });
            requestsSent++;
          } else {
            console.log('ConfigMenu: Skipping server', url, '- WebSocket state:', ws.readyState);
          }
        });
        
        console.log('ConfigMenu: Total requests sent:', requestsSent);
        
        if (requestsSent === 0) {
          console.log('ConfigMenu: No open connections available');
          this.reviewView.showNoConnections();
        } else {
          this.reviewView.showLoadingWithServers(requestsSent);
          
          setTimeout(() => {
            this.handleRequestTimeout();
          }, 5000);
        }
      } else {
        console.log('ConfigMenu: No active connections available');
        this.reviewView.showNoConnections();
      }
    }
  
    private accumulateTransactions(serverUrl: string, transactions: ReviewTransaction[]): void {
      this.accumulatedTransactions.set(serverUrl, transactions);
    }
  
    private displayAccumulatedTransactions(): void {
      const allTransactions: ReviewTransaction[] = [];
      this.accumulatedTransactions.forEach((transactions, serverUrl) => {
        allTransactions.push(...transactions);
      });
  
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
  
      this.transactions = allTransactions;
      this.reviewView.setTransactions(allTransactions);
    }
  
    private handleRequestTimeout(): void {
      if (this.pendingRequestsMap.size > 0) {
        this.displayAccumulatedTransactions();
        this.pendingRequestsMap.clear();
      }
    }
  
    private handlePlayTransaction(transaction: ReviewTransaction): void {
      console.log('ConfigMenu: Play transaction clicked for:', transaction.name, 'from server:', transaction.serverUrl);
      console.log('ConfigMenu: Transaction data:', JSON.stringify(transaction, null, 2));
      
      // Check if Glass class is available
      console.log('ConfigMenu: Glass class available:', !!window.Glass);
      console.log('ConfigMenu: Glass class constructor:', window.Glass);
      
      const glassMessage = {
        event: 'message',
        data: {
          id: transaction.id.toString(),
          messageId: 'configmenu_' + transaction.id.toString(),
          messageName: transaction.name || '',
          messageType: transaction.messageType || 'image',
          status: 'SUCCESS',
          position: transaction.position || '{"h":1,"v":1}',
          duration: transaction.duration || 10,
          transparency: transaction.transparency || '0.80',
          needPresent: transaction.needPresent || false,
          askConfirmation: transaction.askConfirmation || false,
          isAsyncronous: transaction.isAsyncronous || false,
          uploads: transaction.uploads || '[]',
          parameters: transaction.parameters || '[]',
          createdAt: new Date().toISOString(),
          expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          baseUrl: transaction.baseUrl || transaction.serverUrl.replace('ws://', 'http://').replace('/ws', '')
        }
      };
      
      console.log('ConfigMenu: Creating Glass with message:', JSON.stringify(glassMessage, null, 2));
      
      if (window.Glass) {
        try {
          console.log('ConfigMenu: Glass class available, creating instance');
          const glassInstance = new window.Glass(transaction.serverUrl, glassMessage);
          console.log('ConfigMenu: Glass instance created successfully:', glassInstance);
          console.log('ConfigMenu: Glass instance properties:', Object.keys(glassInstance));
        } catch (error) {
          console.error('Error creating Glass for transaction:', error);
        }
      } else {
        console.error('Glass class not available - checking global objects:');
        console.error('window.Glass:', window.Glass);
        console.error('window.glassSystem:', window.glassSystem);
        console.error('Available global objects:', Object.keys(window).filter(key => key.toLowerCase().includes('glass')));
      }
    }
  
    private getServerName(url: string): string {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname || url;
      } catch (e) {
        return url;
      }
    }
  
    private extractNameFromUploads(uploadsString: string): string {
      try {
        const uploads = JSON.parse(uploadsString);
        if (uploads && uploads.length > 0) {
          return uploads[0].filename || 'Transaction';
        }
      } catch (e) {
      }
      return 'Transaction';
    }
  
    private extractDescriptionFromUploads(uploadsString: string): string {
      try {
        const uploads = JSON.parse(uploadsString);
        if (uploads && uploads.length > 0) {
          return uploads[0].description || 'No description';
        }
      } catch (e) {
      }
      return 'No description';
    }

  private setIgnoreMouseEvents(ignore: boolean): void {
    // For Electron
    if (window.electronAPI) {
      if (ignore) {
        window.electronAPI.send('set-ignore-events-true');
      } else {
        window.electronAPI.send('set-ignore-events-false');
      }
    }
    
    // For Android WebView
    if (window.AndroidBridge) {
      if (ignore) {
        window.AndroidBridge.setIgnoreEventsTrue();
      } else {
        window.AndroidBridge.setIgnoreEventsFalse();
      }
    }
  }
}