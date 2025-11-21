export class UserDataManager {
  private isElectron: boolean;

  constructor() {
    this.isElectron = !!(window.electronAPI && window.electronAPI.getUserData);
  }

  async get(key: string, nestedKey?: string): Promise<any> {
    try {
      if (arguments.length === 1) {
        nestedKey = undefined;
      }
      
      if (this.isElectron && window.electronAPI) {
        const result = await window.electronAPI.getUserData(key, nestedKey);
        return result;
      } else {
        const data = localStorage.getItem(key);
        const parsedData = data ? JSON.parse(data) : null;
        
        if (nestedKey !== undefined) {
          return parsedData && typeof parsedData === 'object' ? parsedData[nestedKey] : undefined;
        } else {
          return parsedData;
        }
      }
    } catch (error) {
      console.error('Error getting data for key:', key, 'nestedKey:', nestedKey, error);
      return null;
    }
  }

  async set(key: string, nestedKey: string | any, value?: any): Promise<boolean> {
    try {
      if (arguments.length === 2) {
        value = nestedKey;
        nestedKey = undefined;
      }
      
      if (this.isElectron && window.electronAPI) {
        await window.electronAPI.setUserData(key, nestedKey, value);
      } else {
        if (nestedKey !== undefined) {
          const currentData = localStorage.getItem(key);
          let parsedData = currentData ? JSON.parse(currentData) : {};
          
          if (typeof parsedData !== 'object' || parsedData === null) {
            parsedData = {};
          }
          
          parsedData[nestedKey] = value;
          localStorage.setItem(key, JSON.stringify(parsedData));
        } else {
          localStorage.setItem(key, JSON.stringify(value));
        }
      }
      return true;
    } catch (error) {
      console.error('Error setting data for key:', key, 'nestedKey:', nestedKey, error);
      return false;
    }
  }

  async remove(key: string, nestedKey?: string): Promise<boolean> {
    try {
      if (arguments.length === 1) {
        nestedKey = undefined;
      }
      
      if (this.isElectron && window.electronAPI) {
        await window.electronAPI.removeUserData(key, nestedKey);
      } else {
        if (nestedKey !== undefined) {
          const currentData = localStorage.getItem(key);
          const parsedData = currentData ? JSON.parse(currentData) : {};
          
          if (parsedData && typeof parsedData === 'object' && parsedData !== null) {
            delete parsedData[nestedKey];
            if (Object.keys(parsedData).length === 0) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, JSON.stringify(parsedData));
            }
          }
        } else {
          localStorage.removeItem(key);
        }
      }
      return true;
    } catch (error) {
      console.error('Error removing data for key:', key, 'nestedKey:', nestedKey, error);
      return false;
    }
  }

  async getServers(): Promise<string[]> {
    const servers = await this.get('servers');
    
    if (typeof servers === 'string') {
      return [servers];
    }
    
    if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
      const serverValues = Object.values(servers);
      if (serverValues.length > 0 && typeof serverValues[0] === 'string') {
        return serverValues as string[];
      }
    }
    
    if (Array.isArray(servers)) {
      return servers;
    }
    
    return [];
  }

  async addServer(serverUrl: string): Promise<boolean> {
    const servers = await this.getServers();
    if (!servers.includes(serverUrl)) {
      servers.push(serverUrl);
      await this.set('servers', servers);
      return true;
    }
    return false;
  }

  async removeServer(serverUrl: string): Promise<boolean> {
    const servers = await this.getServers();
    const filteredServers = servers.filter(server => server !== serverUrl);
    
    if (filteredServers.length !== servers.length) {
      await this.set('servers', filteredServers);
      return true;
    }
    return false;
  }

  async getRefreshTokens(): Promise<Record<string, string>> {
    const tokens = await this.get('refreshTokens');
    
    if (!tokens) {
      return {};
    }
    
    if (typeof tokens === 'object' && !Array.isArray(tokens)) {
      return tokens;
    }
    
    if (typeof tokens === 'string') {
      try {
        const parsedTokens = JSON.parse(tokens);
        return parsedTokens;
      } catch (parseError) {
        console.error('DEBUG getRefreshTokens - failed to parse as JSON, treating as single token');
        return { 'default': tokens };
      }
    }
    
    return {};
  }

  async setRefreshToken(serverUrl: string, refreshToken: string): Promise<boolean> {
    await this.set('refreshTokens', serverUrl, refreshToken);
    return true;
  }

  async removeRefreshToken(serverUrl: string): Promise<boolean> {
    await this.remove('refreshTokens', serverUrl);
    return true;
  }

  async getAccessTokens(): Promise<Record<string, string>> {
    const tokens = await this.get('accessTokens');
    return tokens && typeof tokens === 'object' ? tokens : {};
  }

  async setAccessToken(serverUrl: string, accessToken: string): Promise<boolean> {
    await this.set('accessTokens', serverUrl, accessToken);
    return true;
  }

  async removeAccessToken(serverUrl: string): Promise<boolean> {
    await this.remove('accessTokens', serverUrl);
    return true;
  }

  async getRefreshTokenHash(serverUrl: string): Promise<string | null> {
    const hash = await this.get('refreshTokenHashes', serverUrl);
    return hash || null;
  }

  async setRefreshTokenHash(serverUrl: string, refreshTokenHash: string): Promise<boolean> {
    await this.set('refreshTokenHashes', serverUrl, refreshTokenHash);
    return true;
  }

  async removeRefreshTokenHash(serverUrl: string): Promise<boolean> {
    await this.remove('refreshTokenHashes', serverUrl);
    return true;
  }

  async handleRegistrationResponse(serverUrl: string, refreshToken: string, refreshTokenHash?: string): Promise<boolean> {
    await this.addServer(serverUrl);
    await this.setRefreshToken(serverUrl, refreshToken);
    
    if (refreshTokenHash) {
      await this.setRefreshTokenHash(serverUrl, refreshTokenHash);
    }
    
    await this.removeAccessToken(serverUrl);
    
    if (typeof window.connectWebSocket === 'function') {
      window.connectWebSocket(serverUrl);
    } else {
      console.error('connectWebSocket function not available');
    }
    
    return true;
  }

  async getUUID(): Promise<string> {
    if (window.getURLParameter) {
      const uuidFromURL = window.getURLParameter('uuid');
      if (uuidFromURL) {
        return uuidFromURL;
      }
    }
    
    const storedUUID = await this.get('uuid');
    if (storedUUID) {
      return storedUUID;
    }
    
    const newUUID = this.generateUUID();
    await this.set('uuid', newUUID);
    return newUUID;
  }

  generateUUID(): string {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return uuid;
  }

  async getConfig(): Promise<any> {
    const config = await this.get('config');
    const defaultConfig = {
      soundEnabled: true,
      notePosition: 'random',
      noteSize: 'medium',
      transparency: 0.9,
      disappearTime: 10
    };
    
    return { ...defaultConfig, ...config };
  }

  async setConfig(config: any): Promise<boolean> {
    const currentConfig = await this.getConfig();
    const mergedConfig = { ...currentConfig, ...config };
    return await this.set('config', mergedConfig);
  }
}

window.userDataManager = new UserDataManager();