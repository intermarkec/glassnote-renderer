import { ScaleCalculator } from './scale-calculator';
import { FileLoader } from './file-loader';

interface GlassInstance {
  img: HTMLElement;
  formResponse?: any;
  finishGlass: () => void;
}

export class HTMLProcessor {
  private glass: GlassInstance;
  private scaleCalculator: ScaleCalculator;

  constructor(glassInstance: GlassInstance) {
    this.glass = glassInstance;
    this.scaleCalculator = new ScaleCalculator();
  }

  async process(glassContent: HTMLElement, data: any, upload: any): Promise<void> {
    const self = this;
    try {
      const htmlContentPromise = this._extractHtmlFromParameters(data);
      
      if (htmlContentPromise instanceof Promise) {
        const htmlContent = await htmlContentPromise;
        const processedHtml = this._processVariables(htmlContent, data);
        return this._createIframeElement(glassContent, processedHtml, data);
      } else {
        const processedHtml = this._processVariables(htmlContentPromise, data);
        if (!processedHtml || processedHtml.trim() === '') {
          return Promise.resolve();
        }
        return this._createIframeElement(glassContent, processedHtml, data);
      }
    } catch (htmlError) {
      console.error('Error extracting HTML from parameters:', htmlError);
      throw htmlError;
    }
  }

  private _extractHtmlFromParameters(data: any): string | Promise<string> {
    try {
      if (data.messageType === 'form') {
        const uploads = JSON.parse(data.uploads);
        const htmlUpload = uploads.find((upload: any) => {
          return upload.mimetype === 'text/html' || upload.path.endsWith('.html');
        });
        
        if (htmlUpload) {
          return this._loadHtmlFromUpload(htmlUpload, data);
        }
      }
      
      const parameters = JSON.parse(data.parameters);
      const htmlParam = parameters.find((param: any) => param.label === 'html');
      
      if (!htmlParam || !htmlParam.value) {
        return '';
      }
      
      return htmlParam.value;
    } catch (error) {
      console.error('Error extracting HTML from parameters:', error);
      throw new Error('Invalid parameters format: ' + (error as Error).message);
    }
  }

  private _processVariables(htmlContent: string, data: any): string {
    const appVersion = window.appVersion || '';
    const rendererVersion = window.rendererVersion || 'TEMPORAL';
    
    let processedHtml = htmlContent.replace(
      /%VERSION%/g,
      appVersion + ',' + rendererVersion
    );
    
    if (data.messageType === 'form' && data.parameters) {
      try {
        const parameters = JSON.parse(data.parameters);
        
        parameters.forEach((param: any) => {
          if (param.label && param.value !== undefined) {
            const escapedLabel = param.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedLabel, 'g');
            processedHtml = processedHtml.replace(regex, param.value);
          }
        });
      } catch (error) {
        console.error('Error processing form parameters:', error);
      }
    }
    
    return processedHtml;
  }

  private _createIframeElement(glassContent: HTMLElement, htmlContent: string, data: any): Promise<void> {
    const self = this;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const rootDiv = tempDiv.querySelector('div');
    
    if (!rootDiv) {
      return Promise.resolve();
    }

    const isForm = rootDiv.classList.contains('form');
    if (isForm) {
      glassContent.dataset.isForm = 'true';
      this.glass.formResponse = null;
    }

    const widthAttr = rootDiv.getAttribute('width');
    const heightAttr = rootDiv.getAttribute('height');
    const widthStyle = rootDiv.style.width;
    const heightStyle = rootDiv.style.height;
    
    const widthStyleValue = widthStyle ? parseInt(widthStyle) : 0;
    const heightStyleValue = heightStyle ? parseInt(heightStyle) : 0;
    
    const width = parseInt((widthAttr || widthStyleValue.toString() || '0'));
    const height = parseInt((heightAttr || heightStyleValue.toString() || '0'));
    
    if (width <= 0 || height <= 0) {
      return Promise.resolve();
    }

    const scaleFactor = this.scaleCalculator.calculateScaleFactor();
    
    const dimensions = this.scaleCalculator.calculateScaledDimensions(
      width,
      height,
      scaleFactor
    );
    
    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
    iframe.style.border = 'none';
    iframe.style.width = dimensions.width + 'px';
    iframe.style.height = dimensions.height + 'px';
    iframe.style.overflow = 'hidden';
    iframe.style.display = 'block';
    iframe.style.transform = 'translateZ(0)';
    iframe.style.minHeight = dimensions.height + 'px';
    iframe.style.maxHeight = dimensions.height + 'px';
    iframe.style.setProperty('width', dimensions.width + 'px', 'important');
    iframe.style.setProperty('height', dimensions.height + 'px', 'important');
    iframe.style.setProperty('min-height', dimensions.height + 'px', 'important');
    iframe.style.setProperty('max-height', dimensions.height + 'px', 'important');
    iframe.style.border = 'none';
    iframe.style.pointerEvents = 'auto';
    
    iframe.srcdoc = this._wrapHtmlInSafeDocument(htmlContent, dimensions.ratio, dimensions.width, dimensions.height);

    glassContent.appendChild(iframe);
    
    if (glassContent.dataset.isForm === 'true') {
      this._enableFormTouch(glassContent);
      this._setupFormResponseCapture(glassContent, iframe);
    }
    
    return Promise.resolve();
  }

  private _wrapHtmlInSafeDocument(htmlContent: string, scaleFactor: number, originalWidth: number, originalHeight: number): string {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = htmlContent;

    const rootDiv = tempContainer.firstElementChild as HTMLElement;
    if (rootDiv) {
      rootDiv.style.fontSize = Math.round(100 * scaleFactor) + 'px';
      rootDiv.setAttribute('width', '100%');
      rootDiv.setAttribute('height', '100%');
    }

    let modifiedHtml = tempContainer.innerHTML;
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' 'self'; style-src 'unsafe-inline' 'self'; default-src 'self' data: blob:;">
    <style>
        body, html {
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            width: ${originalWidth}px !important;
            height: ${originalHeight}px !important;
        }
        body > div:first-child {
            width: ${originalWidth}px !important;
            height: ${originalHeight}px !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
        }
        * {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
        }
        * {
            -webkit-touch-callout: none;
            -webkit-user-drag: none;
        }
    </style>
</head>
<body>
    ${modifiedHtml}
</body>
</html>`;
  }

  private _loadHtmlFromUpload(upload: any, data: any): Promise<string> {
    const self = this;
    
    return new Promise(function(resolve, reject) {
      try {
        const baseUrl = data.baseUrl || '';
        const fullUrl = baseUrl + upload.path;
        
        fetch(fullUrl)
          .then(function(response) {
            if (!response.ok) {
              throw new Error('HTTP error ' + response.status);
            }
            return response.text();
          })
          .then(function(htmlContent) {
            resolve(htmlContent);
          })
          .catch(function(error) {
            console.error('Error loading HTML from upload:', error);
            reject(new Error('Failed to load HTML from upload: ' + error.message));
          });
      } catch (error) {
        console.error('Error processing HTML upload:', error);
        reject(error);
      }
    });
  }

  private _enableFormTouch(glassContent: HTMLElement): void {
    try {
      if (window.AndroidBridge) {
        window.activeConfirmationGlasses = window.activeConfirmationGlasses || 0;
        window.activeConfirmationGlasses++;
        window.AndroidBridge.setIgnoreEventsFalse();
      } else if (window.electronAPI) {
        this._setupFormMouseEvents(glassContent);
      }
    } catch (e) {
      console.error('Error enabling form touch:', e);
    }
  }

  private _setupFormMouseEvents(glassContent: HTMLElement): void {
    const self = this;
    
    const iframe = glassContent.querySelector('iframe');
    if (!iframe) {
      return;
    }
    
    iframe.addEventListener('mouseenter', function() {
      try {
        if (window.electronAPI) {
          window.electronAPI.send('set-ignore-events-false');
        }
      } catch (e) {
        console.error('Error enabling form click on mouseenter:', e);
      }
    });
    
    iframe.addEventListener('mouseleave', function() {
      try {
        if (window.electronAPI) {
          window.electronAPI.send('set-ignore-events-true');
        }
      } catch (e) {
        console.error('Error disabling form click on mouseleave:', e);
      }
    });
    
    glassContent.addEventListener('mouseenter', function() {
      try {
        if (window.electronAPI) {
          window.electronAPI.send('set-ignore-events-false');
        }
      } catch (e) {
        console.error('Error enabling form click on glassContent mouseenter:', e);
      }
    });
    
    glassContent.addEventListener('mouseleave', function() {
      try {
        if (window.electronAPI) {
          window.electronAPI.send('set-ignore-events-true');
        }
      } catch (e) {
        console.error('Error disabling form click on glassContent mouseleave:', e);
      }
    });
    
    try {
      if (window.electronAPI) {
        window.electronAPI.send('set-ignore-events-false');
      }
    } catch (e) {
      console.error('Error forcing click enablement:', e);
    }
  }

  private _setupFormResponseCapture(glassContent: HTMLElement, iframe: HTMLIFrameElement): void {
    const self = this;
    
    window.addEventListener('message', function(event) {
      if (event.source === iframe.contentWindow) {
        try {
          const messageData = JSON.parse(event.data);
          if (messageData.response) {
            self.glass.formResponse = messageData.response;
            self.glass.finishGlass();
          }
        } catch (e) {
          console.error('Error parsing form response:', e);
        }
      }
    });
  }
}

window.HTMLProcessor = HTMLProcessor;