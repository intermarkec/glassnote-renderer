// Registration system for GlassNote (TypeScript implementation)
// Based on original renderer/registration-websocket.js

// Global variables
let registrationWebSocket: WebSocket | null = null;
let isRegistrationInProgress = false;

// Default registration server URL
const DEFAULT_REGISTRATION_SERVER_URL = 'wss://glassnotereg.intermark.ec/ws';

// Function to generate UUID (compatible with original implementation)
function generateUUID(): string {
  // Try to use userDataManager's generateUUID if available
  if (window.userDataManager && window.userDataManager.generateUUID) {
    return window.userDataManager.generateUUID();
  }
  
  // Fallback implementation
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return uuid;
}

// Function to request registration code
export function requestRegistrationCode(): void {
  // Prevent multiple simultaneous registration attempts
  if (isRegistrationInProgress) {
    console.log('Registration already in progress');
    return;
  }
  
  // Mark registration as in progress
  isRegistrationInProgress = true;
  
  // Get registration server URL
  const registrationServerUrl = window.REGISTRATION_SERVER_URL || 'wss://glassnotereg.intermark.ec/ws';
  
  console.log('Requesting registration code from:', registrationServerUrl);
  
  // Check WebSocket support
  if (typeof WebSocket === 'undefined') {
    console.error('WebSocket is not supported in this browser');
    isRegistrationInProgress = false;
    return;
  }

  // Close existing registration connection
  if (registrationWebSocket) {
    registrationWebSocket.close();
    registrationWebSocket = null;
  }

  // Create new WebSocket connection
  try {
    registrationWebSocket = new WebSocket(registrationServerUrl);
    
    registrationWebSocket.onopen = async function() {
      console.log('Registration WebSocket connection opened');
      
      // Get UUID
      let uuid = window.uuid;
      if (!uuid && window.userDataManager) {
        try {
          uuid = await window.userDataManager.getUUID();
        } catch (error) {
          console.error('Error getting UUID from userDataManager:', error);
          uuid = window.generateUUID ? window.generateUUID() : 'unknown-uuid';
        }
      } else if (!uuid) {
        uuid = localStorage.getItem('device_uuid') || (window.generateUUID ? window.generateUUID() : 'unknown-uuid');
      }
      
      // Get OS info
      let osInfo = '';
      if (window.AndroidBridge) {
        osInfo = 'android';
      } else if (window.electronAPI && window.electronAPI.getOSInfo) {
        const info = window.electronAPI.getOSInfo();
        osInfo = info ? info.platform : navigator.platform;
      } else {
        osInfo = navigator.platform;
      }

      // Prepare registration request
      const data = {
        event: 'keycode',
        data: {
          uuid: uuid,
          os: osInfo,
          nonce: Date.now(),
          localIps: '["127.0.0.1"]',
        },
      };
      
      try {
        registrationWebSocket?.send(JSON.stringify(data));
      } catch (sendError) {
        console.error('Failed to send registration request:', sendError);
      }
    };

    registrationWebSocket.onerror = function(error: Event) {
      console.error('Registration WebSocket error:', error);
    };

    registrationWebSocket.onclose = function(event: CloseEvent) {
      console.log('Registration WebSocket connection closed');
      registrationWebSocket = null;
      isRegistrationInProgress = false;
      
      // Clear keycode display if exists
      const keycodeElement = document.getElementById('keycode');
      if (keycodeElement) {
        keycodeElement.textContent = '';
      }
    };

    registrationWebSocket.onmessage = async function(event: MessageEvent) {
      try {
        const message = JSON.parse(event.data);
        await handleRegistrationResponse(message);
      } catch (parseError) {
        console.error('Failed to parse registration message:', parseError);
      }
    };
    
  } catch (error) {
    console.error('Failed to create registration WebSocket:', error);
    isRegistrationInProgress = false;
  }
}

// Function to handle registration response
async function handleRegistrationResponse(response: any): Promise<void> {
  try {
    if (response.event === 'keycode' && response.data && response.data.keycode) {
      const keycodeElement = document.getElementById('keycode');
      if (keycodeElement) {
        keycodeElement.textContent = response.data.keycode;
        console.log('Registration code received:', response.data.keycode);
        
        // Show window when code is displayed
        if (typeof window.checkWindowVisibility === 'function') {
          window.checkWindowVisibility();
        }
      }
    } else if (response.event === 'register' && response.data && response.data.server) {
      const serverUrl = response.data.server;
      const refreshToken = response.data.refreshToken;
      const refreshTokenHash = response.data.refreshTokenHash;
      
      // Save server using userDataManager
      if (window.userDataManager && window.userDataManager.handleRegistrationResponse) {
        try {
          await window.userDataManager.handleRegistrationResponse(
            serverUrl, 
            refreshToken || '', 
            refreshTokenHash
          );
          console.log('Server registered successfully:', serverUrl);
        } catch (error) {
          console.error('Error saving server:', error);
        }
      }

      // Clear keycode display
      const keycodeElement = document.getElementById('keycode');
      if (keycodeElement) {
        keycodeElement.textContent = '';
        
        // Hide window when code is cleared
        if (typeof window.checkWindowVisibility === 'function') {
          window.checkWindowVisibility();
        }
      }
    } else if (response.event === 'error') {
      console.error('Registration error:', response.data);
    }
  } catch (error) {
    console.error('Error handling registration response:', error);
  }
}

// Function to close registration connection
export function closeRegistrationConnection(): void {
  if (registrationWebSocket) {
    registrationWebSocket.close();
    registrationWebSocket = null;
  }
  
  // Clear keycode display
  const keycodeElement = document.getElementById('keycode');
  if (keycodeElement) {
    keycodeElement.textContent = '';
    
    // Hide window when code is cleared
    if (typeof window.checkWindowVisibility === 'function') {
      window.checkWindowVisibility();
    }
  }
  
  console.log('Registration connection closed');
}

// Function to handle register button click
export async function handleRegisterButtonClick(): Promise<void> {
  // Get UUID
  let uuid = window.uuid;
  if (!uuid && window.userDataManager) {
    try {
      uuid = await window.userDataManager.getUUID();
    } catch (error) {
      console.error('Error getting UUID from userDataManager:', error);
      uuid = window.generateUUID ? window.generateUUID() : 'unknown-uuid';
    }
  } else if (!uuid) {
    uuid = localStorage.getItem('device_uuid') || (window.generateUUID ? window.generateUUID() : 'unknown-uuid');
  }
  
  const registerUrl = `https://glassnote.intermark.ec/suscribe/?uuid=${encodeURIComponent(uuid)}`;
  
  console.log('Opening registration URL:', registerUrl);
  
  // Open registration URL
  if (window.electronAPI && window.electronAPI.openRegistrationWindow) {
    window.electronAPI.openRegistrationWindow(registerUrl);
  } else if (window.AndroidBridge && window.AndroidBridge.openExternal) {
    window.AndroidBridge.openExternal(registerUrl);
  } else if (window.electronAPI && window.electronAPI.openExternalBrowser) {
    window.electronAPI.openExternalBrowser(registerUrl);
  } else {
    window.open(registerUrl, '_blank', 'noopener,noreferrer');
  }
}

// Function to position register button below keycode (no-op in new system)
export function positionRegisterButtonBelowKeycode(): void {
  // Not needed in new system
}

// Make functions globally available
export function setupRegistrationSystem(): void {
  // Set default registration server URL if not already set
  if (!window.REGISTRATION_SERVER_URL) {
    window.REGISTRATION_SERVER_URL = DEFAULT_REGISTRATION_SERVER_URL;
  }
  
  // Make generateUUID available globally if not already set
  if (!window.generateUUID) {
    window.generateUUID = generateUUID;
  }
  
  window.requestRegistrationCode = requestRegistrationCode;
  window.closeRegistrationConnection = closeRegistrationConnection;
  window.handleRegisterButtonClick = handleRegisterButtonClick;
  window.positionRegisterButtonBelowKeycode = positionRegisterButtonBelowKeycode;
  
  console.log('Registration system initialized');
}