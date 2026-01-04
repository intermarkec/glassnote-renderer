// Common types used across services
export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  type: string;
  readyState: number;
  url: string;
}

export interface WebSocketMessage {
  event: string;
  data: any;
}

export interface GlassData {
  url: string | null;
  message: {
    event: string;
    data: {
      id: number;
      messageId: string;
      type?: string;
      uploads?: string;
      position: string;
      duration?: number;
      transparency?: string;
      isUserDevice?: boolean;
      needPresent?: boolean;
      askConfirmation?: boolean;
      isAsyncronous?: boolean;
      baseUrl?: string;
      parameters?: string;
      messageType: string;
    };
  };
  timestamp: number;
}

export interface TokenData {
  token?: string;
  refreshToken?: string;
  refreshTokenHash?: string;
}

export type PlatformContext = 'android' | 'electron' | 'browser';

// Core Service Interfaces
export interface IWebSocketManager {
  connect(url: string): Promise<void>;
  getStatus(url: string): ConnectionStatus;
  getAllStatuses(): Record<string, ConnectionStatus>;
  forceReconnect(url: string): void;
  handleNetworkRestored(): void;
  initialize?(): Promise<void>;
}

export interface IGlassSystem {
  createGlass(url: string | null, message: any): any; // Returns Glass instance
  getActiveGlasses(): Map<string, any>;
  cleanupGhostGlasses(): number;
  playGlassSound(): void;
  playQueueSound(): void;
  initialize?(): Promise<void>;
}

export interface IUserDataManager {
  getServers(): Promise<string[]>;
  getUUID(): Promise<string>;
  getAccessTokens(): Promise<Record<string, string>>;
  getRefreshTokens(): Promise<Record<string, string>>;
  getRefreshTokenHash(url: string): Promise<string | null>;
  setAccessToken(url: string, token: string): Promise<boolean>;
  setRefreshToken(url: string, token: string): Promise<boolean>;
  setRefreshTokenHash(url: string, hash: string): Promise<boolean>;
  removeAccessToken(url: string): Promise<boolean>;
  removeRefreshToken(url: string): Promise<boolean>;
  removeServer(url: string): Promise<boolean>;
  get(key: string, nestedKey?: string): Promise<any>;
  set(key: string, nestedKey: string | any, value?: any): Promise<boolean>;
  remove(key: string, nestedKey?: string): Promise<boolean>;
  addServer(serverUrl: string): Promise<boolean>;
  handleRegistrationResponse(
    serverUrl: string,
    refreshToken: string,
    refreshTokenHash?: string
  ): Promise<boolean>;
  getConfig(): Promise<any>;
  setConfig(config: any): Promise<boolean>;
  generateUUID(): string;
  initialize?(): Promise<void>;
}

export interface IElectronBridge {
  showRegistrationCode(): void;
  hideRegistrationCode(): void;
  showConfigMenu(view?: string): void;
  openExternal(url: string): void;
  openExternalBrowser(url: string): void;
  openRegistrationWindow(url: string): void;
  getUserData(key: string, nestedKey?: string): Promise<any>;
  setUserData(key: string, nestedKey: string | undefined, value: any): Promise<void>;
  removeUserData(key: string, nestedKey?: string): Promise<void>;
  showWindow(): void;
  hideWindow(): void;
  setIgnoreMouseEvents(ignore: boolean): void;
  getPlatformContext(): PlatformContext;
  initialize?(): Promise<void>;
}

export interface IConfigMenu {
  show(view?: string): void;
  hide(): void;
  toggle(view?: string): void;
  isVisible(): boolean;
  setView(view: string): void;
  initialize?(): Promise<void>;
}

export interface ISoundSystem {
  playSound(soundType: string): void;
  stopSound(soundType: string): void;
  playGlassSound(): void;
  playQueueSound(): void;
  preloadSounds(): Promise<void>;
  setVolume(volume: number): void;
  initialize?(): Promise<void>;
}

export interface IAppInit {
  initialize(): Promise<void>;
  getAppVersion(): string;
  getUUID(): string;
  getServers(): string[];
  isBrowserMode(): boolean;
  isElectronMode(): boolean;
  isAndroidMode(): boolean;
}

export interface IDomEvents {
  initialize(): Promise<void>;
  addEventListener(type: string, handler: EventListener): void;
  removeEventListener(type: string, handler: EventListener): void;
  dispatchEvent(event: Event): boolean;
}