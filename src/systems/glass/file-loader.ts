// FileLoader utility for loading files with fallbacks for older browsers

/**
 * Utilidad para cargar archivos con fallbacks para navegadores antiguos
 */
export class FileLoader {
  
  /**
   * Carga un archivo de texto usando Fetch API con fallback a XMLHttpRequest
   * @param url - URL del archivo a cargar
   * @returns Contenido del archivo
   */
  static loadText(url: string): Promise<string> {
    return new Promise(function(resolve, reject) {
      // Intentar Fetch API primero (navegadores modernos)
      if (typeof fetch !== 'undefined') {
        fetch(url)
          .then(function(response) {
            if (!response.ok) {
              throw new Error('HTTP error! status: ' + response.status)
            }
            return response.text()
          })
          .then(resolve)
          .catch(function(error) {
            console.warn('Fetch failed for ' + url + ', trying XHR fallback:', error)
            FileLoader._loadTextWithXHR(url, resolve, reject)
          })
      } else {
        // Fallback a XMLHttpRequest para navegadores antiguos
        FileLoader._loadTextWithXHR(url, resolve, reject)
      }
    })
  }

  /**
   * Carga un archivo JSON usando Fetch API con fallback
   * @param url - URL del archivo JSON
   * @returns Objeto parseado del JSON
   */
  static loadJSON(url: string): Promise<any> {
    return new Promise(function(resolve, reject) {
      if (typeof fetch !== 'undefined') {
        fetch(url)
          .then(function(response) {
            if (!response.ok) {
              throw new Error('HTTP error! status: ' + response.status)
            }
            return response.json()
          })
          .then(resolve)
          .catch(function(error) {
            console.warn('Fetch failed for JSON ' + url + ', trying XHR fallback:', error)
            FileLoader._loadJSONWithXHR(url, resolve, reject)
          })
      } else {
        FileLoader._loadJSONWithXHR(url, resolve, reject)
      }
    })
  }

  /**
   * Carga una imagen
   * @param url - URL de la imagen
   * @returns Imagen cargada
   */
  static loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise(function(resolve, reject) {
      const img = new Image()
      img.onload = function() { 
        resolve(img) 
      }
      img.onerror = function() {
        reject(new Error('Failed to load image: ' + url))
      }
      img.src = url
    })
  }

  /**
   * Carga el package.json con fallback a versión temporal
   * @returns Versión del package
   */
  static loadPackageVersion(): Promise<string> {
    // Build absolute path based on current window location
    const basePath = window.location.origin + window.location.pathname;
    const directory = basePath.substring(0, basePath.lastIndexOf('/'));
    const absolutePath = directory + '/package.json';
    
    // Try multiple possible paths for package.json
    const paths = ['./package.json', '/package.json', '../package.json', absolutePath];
    
    const tryLoad = (index: number): Promise<string> => {
      if (index >= paths.length) {
        return Promise.resolve('TEMPORAL');
      }
      
      return FileLoader.loadJSON(paths[index])
        .then(function(packageData) {
          return packageData.version || 'TEMPORAL';
        })
        .catch(function() {
          return tryLoad(index + 1);
        });
    };
    
    return tryLoad(0);
  }

  /**
   * Fallback privado para cargar texto con XMLHttpRequest
   * @private
   */
  private static _loadTextWithXHR(url: string, resolve: (value: string) => void, reject: (reason?: any) => void): void {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          resolve(xhr.responseText)
        } else {
          reject(new Error('XHR HTTP error! status: ' + xhr.status))
        }
      }
    }
    xhr.onerror = function() {
      reject(new Error('XHR network error loading: ' + url))
    }
    xhr.send()
  }

  /**
   * Fallback privado para cargar JSON con XMLHttpRequest
   * @private
   */
  private static _loadJSONWithXHR(url: string, resolve: (value: any) => void, reject: (reason?: any) => void): void {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText)
            resolve(data)
          } catch (e) {
            reject(new Error('JSON parse error: ' + (e as Error).message))
          }
        } else {
          reject(new Error('XHR HTTP error! status: ' + xhr.status))
        }
      }
    }
    xhr.onerror = function() {
      reject(new Error('XHR network error loading JSON: ' + url))
    }
    xhr.send()
  }
}

// Exportar al scope global
window.FileLoader = FileLoader