import { BaseService } from './base-service';
import { IUserDataManager } from './interfaces';
import { serviceRegistry } from './registry';

/**
 * User Data Manager Service
 * Handles user data storage and retrieval using Electron's ipcRenderer
 */
export class UserDataManagerService extends BaseService implements IUserDataManager {
  constructor() {
    super('userDataManager');
  }

  /**
   * Initialize the user data manager
   */
  protected async onInitialize(): Promise<void> {
    // No initialization needed
  }

  /**
   * Clean up the user data manager
   */
  protected async onCleanup(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Get data from user data store
   */
  async get(key: string, nestedKey?: string): Promise<any> {
    try {
      const result = await (window as any).electronAPI?.getUserData(key, nestedKey);
      return result;
    } catch (error) {
      console.error('Error getting user data:', error);
      throw error;
    }
  }

  /**
   * Set data in user data store
   */
  async set(key: string, nestedKey: string | any, value?: any): Promise<boolean> {
    try {
      if (typeof nestedKey === 'string' && value !== undefined) {
        // Set nested value: key, nestedKey, value
        await (window as any).electronAPI?.setUserData(key, nestedKey, value);
      } else if (value === undefined) {
        // Set entire object at key: key, value (where nestedKey is actually the value)
        await (window as any).electronAPI?.setUserData(key, undefined, nestedKey);
      } else {
        // This shouldn't happen, but fallback
        await (window as any).electronAPI?.setUserData(key, nestedKey, value);
      }
      return true;
    } catch (error) {
      console.error('Error setting user data:', error);
      return false;
    }
  }

  /**
   * Remove data from user data store
   */
  async remove(key: string, nestedKey?: string): Promise<boolean> {
    try {
      await (window as any).electronAPI?.removeUserData(key, nestedKey);
      return true;
    } catch (error) {
      console.error('Error removing user data:', error);
      return false;
    }
  }

  /**
   * Get list of registered servers
   */
  async getServers(): Promise<string[]> {
    try {
      const servers = await this.get('servers');
      return Array.isArray(servers) ? servers : [];
    } catch (error) {
      console.error('Error getting servers:', error);
      return [];
    }
  }

  /**
   * Add a server to the list
   */
  async addServer(serverUrl: string): Promise<boolean> {
    try {
      const servers = await this.getServers();
      if (!servers.includes(serverUrl)) {
        servers.push(serverUrl);
        await this.set('servers', servers);
      }
      return true;
    } catch (error) {
      console.error('Error adding server:', error);
      return false;
    }
  }

  /**
   * Remove a server from the list
   */
  async removeServer(serverUrl: string): Promise<boolean> {
    try {
      const servers = await this.getServers();
      const filteredServers = servers.filter((server: string) => server !== serverUrl);
      await this.set('servers', filteredServers);
      return true;
    } catch (error) {
      console.error('Error removing server:', error);
      return false;
    }
  }

  /**
   * Get refresh tokens
   */
  async getRefreshTokens(): Promise<Record<string, string>> {
    try {
      const tokens = await this.get('refreshTokens');
      
      // Handle corrupted data: if tokens is an array, convert to empty object
      if (Array.isArray(tokens)) {
        console.warn('Refresh tokens stored as array instead of object, returning empty object');
        return {};
      }
      
      // If it's not an object or is null/undefined, return empty object
      if (!tokens || typeof tokens !== 'object') {
        return {};
      }
      
      return tokens;
    } catch (error) {
      console.error('Error getting refresh tokens:', error);
      return {};
    }
  }

  /**
   * Set refresh token for a server
   */
  async setRefreshToken(serverUrl: string, refreshToken: string): Promise<boolean> {
    try {
      const tokens = await this.getRefreshTokens();
      tokens[serverUrl] = refreshToken;
      await this.set('refreshTokens', tokens);
      return true;
    } catch (error) {
      console.error('Error setting refresh token:', error);
      return false;
    }
  }

  /**
   * Remove refresh token for a server
   */
  async removeRefreshToken(serverUrl: string): Promise<boolean> {
    try {
      const tokens = await this.getRefreshTokens();
      delete tokens[serverUrl];
      await this.set('refreshTokens', tokens);
      return true;
    } catch (error) {
      console.error('Error removing refresh token:', error);
      return false;
    }
  }

  /**
   * Get access tokens
   */
  async getAccessTokens(): Promise<Record<string, string>> {
    try {
      const tokens = await this.get('accessTokens');
      
      // Handle corrupted data: if tokens is an array, convert to empty object
      if (Array.isArray(tokens)) {
        console.warn('Access tokens stored as array instead of object, returning empty object');
        return {};
      }
      
      // If it's not an object or is null/undefined, return empty object
      if (!tokens || typeof tokens !== 'object') {
        return {};
      }
      
      return tokens;
    } catch (error) {
      console.error('Error getting access tokens:', error);
      return {};
    }
  }

  /**
   * Set access token for a server
   */
  async setAccessToken(serverUrl: string, accessToken: string): Promise<boolean> {
    try {
      const tokens = await this.getAccessTokens();
      tokens[serverUrl] = accessToken;
      await this.set('accessTokens', tokens);
      return true;
    } catch (error) {
      console.error('Error setting access token:', error);
      return false;
    }
  }

  /**
   * Remove access token for a server
   */
  async removeAccessToken(serverUrl: string): Promise<boolean> {
    try {
      const tokens = await this.getAccessTokens();
      delete tokens[serverUrl];
      await this.set('accessTokens', tokens);
      return true;
    } catch (error) {
      console.error('Error removing access token:', error);
      return false;
    }
  }

  /**
   * Get refresh token hash for a server
   */
  async getRefreshTokenHash(serverUrl: string): Promise<string | null> {
    try {
      const hashes = await this.get('refreshTokenHashes');
      return hashes?.[serverUrl] || null;
    } catch (error) {
      console.error('Error getting refresh token hash:', error);
      return null;
    }
  }

  /**
   * Set refresh token hash for a server
   */
  async setRefreshTokenHash(serverUrl: string, refreshTokenHash: string): Promise<boolean> {
    try {
      const hashes = await this.get('refreshTokenHashes') || {};
      hashes[serverUrl] = refreshTokenHash;
      await this.set('refreshTokenHashes', hashes);
      return true;
    } catch (error) {
      console.error('Error setting refresh token hash:', error);
      return false;
    }
  }

  /**
   * Remove refresh token hash for a server
   */
  async removeRefreshTokenHash(serverUrl: string): Promise<boolean> {
    try {
      const hashes = await this.get('refreshTokenHashes') || {};
      delete hashes[serverUrl];
      await this.set('refreshTokenHashes', hashes);
      return true;
    } catch (error) {
      console.error('Error removing refresh token hash:', error);
      return false;
    }
  }

  /**
   * Handle registration response
   */
  async handleRegistrationResponse(serverUrl: string, refreshToken: string, refreshTokenHash?: string): Promise<boolean> {
    try {
      await this.addServer(serverUrl);
      await this.setRefreshToken(serverUrl, refreshToken);
      
      if (refreshTokenHash) {
        await this.setRefreshTokenHash(serverUrl, refreshTokenHash);
      }
      
      await this.removeAccessToken(serverUrl);
      
      // Try to connect using WebSocketManagerService from service registry
      if (serviceRegistry.has('websocketManager')) {
        const websocketManager = serviceRegistry.get<any>('websocketManager');
        if (websocketManager && typeof websocketManager.connect === 'function') {
          websocketManager.connect(serverUrl);
        }
      } else {
        console.error('WebSocketManagerService not available in service registry');
      }
      
      return true;
    } catch (error) {
      console.error('Error handling registration response:', error);
      return false;
    }
  }

  /**
   * Get UUID
   * IMPORTANT: Always use the UUID provided by Electron main process
   * Never generate a new UUID in the renderer
   */
  async getUUID(): Promise<string> {
    try {
      console.log('getUUID(): Starting UUID retrieval...');
      console.log('getUUID(): window.uuid =', window.uuid, '(type:', typeof window.uuid, ')');
      
      // CRITICAL FIX: Always use window.uuid if it exists (provided by Electron)
      // Electron's UUID should be trusted without validation
      if (window.uuid && typeof window.uuid === 'string' && window.uuid.trim() !== '') {
        console.log('getUUID(): Using UUID from window (Electron-provided, trusted):', window.uuid);
        return window.uuid;
      }
      
      console.warn('getUUID(): window.uuid is not available, empty, or not a string');
      
      // Second, try to get UUID from stored data
      let uuid = await this.get('uuid');
      
      // Validate the UUID - it should not contain invalid characters
      if (!uuid || this.isInvalidUUID(uuid)) {
        // UUID is invalid or doesn't exist
        // Instead of generating a new one, try to get it from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const uuidFromUrl = urlParams.get('uuid');
        
        if (uuidFromUrl && !this.isInvalidUUID(uuidFromUrl)) {
          console.log('getUUID(): Using UUID from URL parameter:', uuidFromUrl);
          uuid = uuidFromUrl;
        } else {
          // Last resort: check if we have a valid UUID in localStorage (legacy)
          const legacyUUID = localStorage.getItem('device_uuid');
          if (legacyUUID && !this.isInvalidUUID(legacyUUID)) {
            console.log('getUUID(): Using legacy UUID from localStorage:', legacyUUID);
            uuid = legacyUUID;
          } else {
            // Only generate as absolute last resort
            console.warn('getUUID(): No valid UUID found, generating temporary one (will not be persisted)');
            uuid = this.generateUUID();
            // DO NOT call this.set('uuid', uuid) - UUID should only be set by Electron main process
          }
        }
      }
      
      return uuid;
    } catch (error) {
      console.error('Error getting UUID:', error);
      // Fallback to window.uuid or generate temporary UUID
      if (window.uuid && typeof window.uuid === 'string') {
        return window.uuid;
      }
      return this.generateUUID();
    }
  }

  /**
   * Check if a UUID is invalid (contains commas, URLs, or other invalid characters)
   */
  private isInvalidUUID(uuid: string): boolean {
    console.log('isInvalidUUID(): Checking UUID:', uuid);
    
    // Check if it's a string
    if (typeof uuid !== 'string') {
      console.log('isInvalidUUID(): Failed - not a string');
      return true;
    }
    
    // Check for common invalid patterns
    if (uuid.includes(',')) {
      console.log('isInvalidUUID(): Failed - contains comma');
      return true;
    }
    if (uuid.includes(' ')) {
      console.log('isInvalidUUID(): Failed - contains space');
      return true;
    }
    if (uuid.includes('://')) {
      console.log('isInvalidUUID(): Failed - contains ://');
      return true;
    }
    if (uuid.includes('ws://')) {
      console.log('isInvalidUUID(): Failed - contains ws://');
      return true;
    }
    if (uuid.includes('wss://')) {
      console.log('isInvalidUUID(): Failed - contains wss://');
      return true;
    }
    if (uuid.length > 100) { // UUIDs should be relatively short
      console.log('isInvalidUUID(): Failed - length > 100:', uuid.length);
      return true;
    }
    
    // Check if it looks like a standard UUID format (optional)
    // Standard UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      // Not a standard UUID format, but might still be valid
      // We'll be lenient and only reject obviously wrong ones
      console.log('isInvalidUUID(): Not standard UUID format, but accepting as valid');
      return false;
    }
    
    console.log('isInvalidUUID(): UUID is valid');
    return false;
  }

  /**
   * Generate a new UUID
   */
  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get configuration
   */
  async getConfig(): Promise<any> {
    try {
      const config = await this.get('config');
      return config || {};
    } catch (error) {
      console.error('Error getting config:', error);
      return {};
    }
  }

  /**
   * Set configuration
   */
  async setConfig(config: any): Promise<boolean> {
    try {
      await this.set('config', config);
      return true;
    } catch (error) {
      console.error('Error setting config:', error);
      return false;
    }
  }
}