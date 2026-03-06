import { ScaleCalculator } from './scale-calculator';
import { FileLoader } from './file-loader';
import { serviceRegistry } from '../../services/registry';
import { IPassthroughService } from '../../services/interfaces';

interface GlassInstance {
  img: HTMLElement;
  formResponse?: any;
  finishGlass: () => void;
}

export class HTMLProcessor {
  private glass: GlassInstance;
  private scaleCalculator: ScaleCalculator;
  private passthroughService: IPassthroughService | null = null;
  private formElementId: string | null = null;

  constructor(glassInstance: GlassInstance) {
    this.glass = glassInstance;
    this.scaleCalculator = new ScaleCalculator();
    
    // Try to get passthrough service
    try {
      this.passthroughService = serviceRegistry.get<IPassthroughService>('passthrough');
    } catch (error) {
      console.warn('PassthroughService not available:', error);
    }
  }

  private _createYoutubeElement(glassContent: HTMLElement, youtubeData: any): void {

    if (!youtubeData || !youtubeData.url) {
      console.error('Invalid YouTube data:', youtubeData);
      return;
    }

    try {
      const container = document.createElement('div');
      container.className = 'container-default';
      container.style.width = '450px';
      container.style.height = '450px';
      container.style.position = 'relative';
      container.style.fontSize = '100px';

      const youtubeDiv = document.createElement('div');
      youtubeDiv.id = 'youtube001';
      youtubeDiv.className = 'element-youtube001';
      youtubeDiv.style.position = 'absolute';
      youtubeDiv.style.left = '11.185%';
      youtubeDiv.style.top = '5.538%';
      youtubeDiv.style.fontSize = '0.16em';
      youtubeDiv.style.width = '73.333%';
      youtubeDiv.style.height = '53.556%';

      const iframe = document.createElement('iframe');
      
      // Asegurar que la URL tenga el formato correcto
      let youtubeUrl = youtubeData.url;
      
      // DEBUG: Si el video tiene error 153, probar con un video conocido que funcione
      console.log('Original YouTube URL:', youtubeUrl);
      
      // Si es un enlace de watch, convertirlo a embed
      if (youtubeUrl.includes('youtube.com/watch?v=')) {
        const videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
        if (videoId) {
          youtubeUrl = `https://www.youtube.com/embed/${videoId}`;
          console.log('Converted watch URL to embed URL:', youtubeUrl);
        }
      }
      
      // Agregar parámetros adicionales para mejor compatibilidad
      try {
        // Intentar crear URL y agregar parámetros
        const urlObj = new URL(youtubeUrl);
        urlObj.searchParams.set('rel', '0'); // No mostrar videos relacionados al final
        urlObj.searchParams.set('modestbranding', '1'); // Menos branding de YouTube
        urlObj.searchParams.set('playsinline', '1'); // Reproducir en línea en iOS
        urlObj.searchParams.set('autoplay', '1'); // Auto-reproducir
        urlObj.searchParams.set('mute', '0'); // No silenciado
        urlObj.searchParams.set('controls', '1'); // Mostrar controles
        urlObj.searchParams.set('enablejsapi', '1'); // Habilitar API JavaScript
        
        // Solo agregar origin si no es file:// (YouTube puede rechazar file://)
        if (window.location.origin && !window.location.origin.startsWith('file://')) {
          urlObj.searchParams.set('origin', window.location.origin);
        }
        
        youtubeUrl = urlObj.toString();
      } catch (error) {
        console.warn('Could not parse YouTube URL for parameter enhancement:', error);
        // Usar la URL original si no se puede parsear
      }
      
      iframe.src = youtubeUrl;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '10px'; // Agregar bordes redondeados
      
      // Configuración de permisos más permisiva para YouTube
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.title = 'YouTube video player';
      iframe.frameBorder = '0';
      
      // Agregar sandbox con permisos específicos para YouTube
      iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation allow-modals';
      
      // Agregar atributos adicionales para mejor compatibilidad
      iframe.loading = 'eager'; // Cargar inmediatamente
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('scrolling', 'no');
      
      // Intentar forzar HTTPS si estamos en file://
      if (window.location.origin.startsWith('file://')) {

        // Agregar parámetro adicional para file://
        try {
          const urlObj = new URL(iframe.src);
          urlObj.searchParams.set('fs', '1'); // Forzar pantalla completa
          iframe.src = urlObj.toString();
        } catch (error) {
          console.warn('No se pudo actualizar URL para file://:', error);
        }
      }
      
      youtubeDiv.appendChild(iframe);
      container.appendChild(youtubeDiv);

      const style = document.createElement('style');
      style.id = 'dynamic-styles';
      style.textContent = `
        .container-default { background: #7b76b9; border-radius: 5%; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: Arial, sans-serif; }
        .element-youtube001 { }
        .element-youtube001:hover { }
        .element-youtube001.active { }
        .element-youtube001.active:hover { }
      `;

      glassContent.appendChild(container);
      glassContent.appendChild(style);

    } catch (error) {
      console.error('Error creating YouTube element:', error);
    }
  }

  private _containsYouTubeContent(htmlContent: string): boolean {

    // Check if HTML contains YouTube iframe or YouTube URL
    const lowerHtml = htmlContent.toLowerCase();

    const hasEmbed = lowerHtml.includes('youtube.com/embed');
    const hasYoutuBe = lowerHtml.includes('youtu.be');
    const hasWatch = lowerHtml.includes('youtube.com/watch');
    const hasSrcYoutube = lowerHtml.includes('src="https://www.youtube.com');
    
    const result = hasEmbed || hasYoutuBe || hasWatch || hasSrcYoutube;
    
    return result;
  }

  private _processYouTubeFromHtml(glassContent: HTMLElement, htmlContent: string, data: any): Promise<void> {
    try {
      // Parse HTML to extract YouTube URL
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      
      // Look for iframe with YouTube URL
      const iframe = tempDiv.querySelector('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
      if (iframe) {
        const youtubeUrl = iframe.getAttribute('src');
        if (youtubeUrl) {
          // Create YouTube element with extracted URL
          this._createYoutubeElement(glassContent, { url: youtubeUrl });
          return Promise.resolve();
        }
      }
      
      // If no iframe found, try to create one from the HTML structure
      // Look for div with id containing "youtube" or class containing "youtube"
      const youtubeDiv = tempDiv.querySelector('[id*="youtube"], [class*="youtube"]');
      if (youtubeDiv) {
        // Try to extract URL from data attributes or text content
        const possibleUrl = youtubeDiv.getAttribute('data-url') || 
                           youtubeDiv.getAttribute('data-src') ||
                           youtubeDiv.textContent?.trim();
        
        if (possibleUrl && (possibleUrl.includes('youtube.com') || possibleUrl.includes('youtu.be'))) {
          this._createYoutubeElement(glassContent, { url: possibleUrl });
          return Promise.resolve();
        }
      }
      
      // If we can't extract YouTube URL, fall back to regular HTML processing
      console.warn('Could not extract YouTube URL from HTML, falling back to regular HTML processing');
      const processedHtml = this._processVariables(htmlContent, data);
      return this._createIframeElement(glassContent, processedHtml, data);
    } catch (error) {
      console.error('Error processing YouTube from HTML:', error);
      // Fall back to regular HTML processing
      const processedHtml = this._processVariables(htmlContent, data);
      return this._createIframeElement(glassContent, processedHtml, data);
    }
  }

  async process(glassContent: HTMLElement, data: any, upload: any): Promise<void> {

    try {
      // Check for explicit YouTube data
      if (data.youtube) {
        this._createYoutubeElement(glassContent, data.youtube);
        return;
      }

      const htmlContentPromise = this._extractHtmlFromParameters(data);
      const htmlContent = htmlContentPromise instanceof Promise ? 
        await htmlContentPromise : htmlContentPromise;
      
      if (!htmlContent || htmlContent.trim() === '') {
        return Promise.resolve();
      }

      // Check if HTML contains YouTube iframe
      const containsYouTube = this._containsYouTubeContent(htmlContent);
      
      if (containsYouTube) {
        return this._processYouTubeFromHtml(glassContent, htmlContent, data);
      }

      const processedHtml = this._processVariables(htmlContent, data);
      return this._createIframeElement(glassContent, processedHtml, data);
    } catch (htmlError) {
      console.error('Error processing content:', htmlError);
      throw htmlError;
    }
  }

  private _extractHtmlFromParameters(data: any): string | Promise<string> {
    
    try {
      // Primero, verificar si hay uploads con contenido HTML
      if (data.uploads) {
        const uploads = JSON.parse(data.uploads);        
        const htmlUpload = uploads.find((upload: any) => {
          const isHtml = upload.mimetype === 'text/html' || 
                         upload.path.endsWith('.html') || 
                         upload.path.endsWith('.htm');
          return isHtml;
        });
        
        if (htmlUpload) {
          return this._loadHtmlFromUpload(htmlUpload, data);
        } 
      } 
      // Si no hay uploads HTML, buscar en parámetros
      if (data.parameters) {
        const parameters = JSON.parse(data.parameters);
        
        const htmlParam = parameters.find((param: any) => param.label === 'html');
        
        if (htmlParam && htmlParam.value) {
          return htmlParam.value;
        }
      }
      
      return '';
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
    
    // JavaScript to inject for button functionality
    const injectedScript = `
<script>
(function() {
  // Function to collect all form data
  function collectFormData() {
    const container = document.querySelector('.container-default') || document.body;
    const items = [];
    const processedFieldnames = new Set();

    // Helper to get fieldname from element
    function getFieldname(el) {
      return el.getAttribute('fieldname') || el.getAttribute('name') || el.id || null;
    }

    // Helper to determine element type
    function getElementType(el) {
      if (el.classList.contains('btn-toggle') || el.classList.contains('btn-toggle-pulse') || el.classList.contains('btn-toggle-slide')) {
        return 'toggle';
      }
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        return 'input';
      }
      if (el.tagName === 'BUTTON') {
        return 'button';
      }
      return el.tagName.toLowerCase();
    }

    // Helper to determine if element is a toggle
    function isToggle(el) {
      return el.classList.contains('btn-toggle') || el.classList.contains('btn-toggle-pulse') || el.classList.contains('btn-toggle-slide');
    }

    // Process input-like elements
    const inputs = container.querySelectorAll('input, textarea, select');
    inputs.forEach(el => {
      const fieldname = getFieldname(el);
      if (!fieldname || processedFieldnames.has(fieldname)) return;

      let value = '';
      let active = false;
      const type = getElementType(el);
      if (el.tagName === 'INPUT') {
        const input = el;
        const inputType = input.type;
        if (inputType === 'checkbox' || inputType === 'radio') {
          value = input.checked ? 'true' : 'false';
          active = input.checked;
        } else {
          value = input.value;
          active = isToggle(el) ? el.classList.contains('active') : false;
        }
      } else if (el.tagName === 'TEXTAREA') {
        value = el.value;
        active = isToggle(el) ? el.classList.contains('active') : false;
      } else if (el.tagName === 'SELECT') {
        value = el.value;
        active = isToggle(el) ? el.classList.contains('active') : false;
      }
      items.push({ fieldname, value, active: isToggle(el) ? active : undefined, type });
      processedFieldnames.add(fieldname);
    });

    // Also include elements with fieldname that are not inputs
    const fieldElements = container.querySelectorAll('[fieldname]');
    fieldElements.forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        return;
      }
      const fieldname = el.getAttribute('fieldname');
      if (!fieldname || processedFieldnames.has(fieldname)) return;
      const staticValue = el.getAttribute('value') || '';
      const type = getElementType(el);
      const active = isToggle(el) ? el.classList.contains('active') : undefined;
      items.push({ fieldname, value: staticValue, active, type });
      processedFieldnames.add(fieldname);
    });

    return items;
  }

  // Timer management
  const timerMap = new Map(); // Map to store timer timeouts
  const timerElements = new Map(); // Map to store timer elements and their data

  // Function to execute timer action
  function executeTimerAction(timerElement) {
    const action = timerElement.getAttribute('data-action');
    if (!action) return;

    // Execute the appropriate action
    if (action === 'Submit') {
      const formData = collectFormData();
      if (window.parent) {
        window.parent.postMessage(JSON.stringify({
          response: formData,
          timer: true
        }), '*');
      }
    } else if (action === 'NextPage') {
      const pages = document.querySelectorAll('[id^="page"]');
      if (pages.length > 0) {
        let currentPage = null;
        let currentIndex = -1;
        
        pages.forEach((page, index) => {
          if (page.style.display !== 'none') {
            currentPage = page;
            currentIndex = index;
          }
        });
        
        if (currentPage && currentIndex >= 0) {
          currentPage.style.display = 'none';
          const nextIndex = (currentIndex + 1) % pages.length;
          pages[nextIndex].style.display = 'block';
          // Update timers after page change
          manageTimers();
        }
      }
    } else if (action === 'PrevPage') {
      const pages = document.querySelectorAll('[id^="page"]');
      if (pages.length > 0) {
        let currentPage = null;
        let currentIndex = -1;
        
        pages.forEach((page, index) => {
          if (page.style.display !== 'none') {
            currentPage = page;
            currentIndex = index;
          }
        });
        
        if (currentPage && currentIndex >= 0) {
          currentPage.style.display = 'none';
          const prevIndex = (currentIndex - 1 + pages.length) % pages.length;
          pages[prevIndex].style.display = 'block';
          // Update timers after page change
          manageTimers();
        }
      }
    }
  }

  // Function to start a timer
  function startTimer(timerElement) {
    const seconds = parseInt(timerElement.getAttribute('data-seconds') || '0');
    if (seconds <= 0) return;

    // Clear existing timer if any
    stopTimer(timerElement);

    // Start new timer
    const timeoutId = setTimeout(() => {
      executeTimerAction(timerElement);
    }, seconds * 1000);

    timerMap.set(timerElement, timeoutId);
  }

  // Function to stop a timer
  function stopTimer(timerElement) {
    if (timerMap.has(timerElement)) {
      clearTimeout(timerMap.get(timerElement));
      timerMap.delete(timerElement);
    }
  }

  // Function to check if timer is in visible page
  function isTimerInVisiblePage(timerElement) {
    const pages = document.querySelectorAll('[id^="page"]');
    for (const page of pages) {
      if (page.style.display !== 'none' && page.contains(timerElement)) {
        return true;
      }
    }
    return false;
  }

  // Function to manage all timers based on page visibility
  function manageTimers() {
    const allTimers = document.querySelectorAll('.timer');
    
    allTimers.forEach(timerElement => {
      if (isTimerInVisiblePage(timerElement)) {
        // Timer is in visible page, ensure it's running
        if (!timerMap.has(timerElement)) {
          startTimer(timerElement);
        }
      } else {
        // Timer is not in visible page, stop it
        stopTimer(timerElement);
      }
    });
  }

  // Initialize functionality when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Add toggle functionality
    const toggleButtons = document.querySelectorAll('.btn-toggle, .btn-toggle-pulse, .btn-toggle-slide');
    toggleButtons.forEach(button => {
      button.addEventListener('click', function() {
        this.classList.toggle('active');
      });
    });

    // Add NextPage functionality
    const nextPageButtons = document.querySelectorAll('.NextPage, .nextPage');
    nextPageButtons.forEach(button => {
      button.addEventListener('click', function() {
        const pages = document.querySelectorAll('[id^="page"]');
        if (pages.length > 0) {
          let currentPage = null;
          let currentIndex = -1;
          
          pages.forEach((page, index) => {
            if (page.style.display !== 'none') {
              currentPage = page;
              currentIndex = index;
            }
          });
          
          if (currentPage && currentIndex >= 0) {
            currentPage.style.display = 'none';
            const nextIndex = (currentIndex + 1) % pages.length;
            pages[nextIndex].style.display = 'block';
            // Update timers after page change
            manageTimers();
          }
        }
      });
    });

    // Add PrevPage functionality
    const prevPageButtons = document.querySelectorAll('.PrevPage, .prevPage');
    prevPageButtons.forEach(button => {
      button.addEventListener('click', function() {
        const pages = document.querySelectorAll('[id^="page"]');
        if (pages.length > 0) {
          let currentPage = null;
          let currentIndex = -1;
          
          pages.forEach((page, index) => {
            if (page.style.display !== 'none') {
              currentPage = page;
              currentIndex = index;
            }
          });
          
          if (currentPage && currentIndex >= 0) {
            currentPage.style.display = 'none';
            const prevIndex = (currentIndex - 1 + pages.length) % pages.length;
            pages[prevIndex].style.display = 'block';
            // Update timers after page change
            manageTimers();
          }
        }
      });
    });

    // Add Submit functionality
    const submitButtons = document.querySelectorAll('.Submit, .submit');
    submitButtons.forEach(button => {
      button.addEventListener('click', function() {
        const formData = collectFormData();
        // Send data to parent window
        if (window.parent) {
          window.parent.postMessage(JSON.stringify({
            response: formData,
            submit: true
          }), '*');
        }
      });
    });

    // Initialize page visibility - show first page, hide others
    const pages = document.querySelectorAll('[id^="page"]');
    if (pages.length > 0) {
      pages.forEach((page, index) => {
        if (index === 0) {
          page.style.display = 'block';
        } else {
          page.style.display = 'none';
        }
      });
    }

    // Initialize timers after page setup
    manageTimers();
  });
})();
</script>`;

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
    ${injectedScript}
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
      }
      
      // Use centralized passthrough service if available
      if (this.passthroughService) {
        this._registerFormWithService(glassContent);
      } else if (window.electronAPI) {
        // Fallback to direct electron API
        this._setupFormMouseEventsLegacy(glassContent);
      }
    } catch (e) {
      console.error('Error enabling form touch:', e);
    }
  }

  private _registerFormWithService(glassContent: HTMLElement): void {
    if (!this.passthroughService) {
      return;
    }
    
    // Generate unique ID for this form
    this.formElementId = `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Register the form container with the service
    this.passthroughService.registerElement(
      this.formElementId,
      () => glassContent,
      80 // Medium priority for forms
    );
    
    // console.log(`HTMLProcessor: Registered form as "${this.formElementId}"`);
    
    // Also register the iframe if it exists
    const iframe = glassContent.querySelector('iframe');
    if (iframe) {
      const iframeId = `${this.formElementId}-iframe`;
      this.passthroughService.registerElement(
        iframeId,
        () => iframe as HTMLElement,
        80,
        true // isIframe: true - this is an iframe element
      );
    }
  }

  private _unregisterFormFromService(): void {
    if (!this.passthroughService || !this.formElementId) {
      return;
    }
    
    // Unregister the form
    this.passthroughService.unregisterElement(this.formElementId);
    
    // Also unregister the iframe if it was registered
    const iframeId = `${this.formElementId}-iframe`;
    this.passthroughService.unregisterElement(iframeId);
    
    this.formElementId = null;
  }

  private _setupFormMouseEventsLegacy(glassContent: HTMLElement): void {
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
    
    const messageHandler = function(event: MessageEvent) {
      if (event.source === iframe.contentWindow) {
        try {
          const messageData = JSON.parse(event.data);
          if (messageData.response) {
            // Store the entire message data to preserve timer/submit flags
            self.glass.formResponse = messageData;
            // Clean up form registration before finishing
            self._unregisterFormFromService();
            self.glass.finishGlass();
          }
        } catch (e) {
          console.error('Error parsing form response:', e);
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Also clean up if the glass finishes without form submission
    const originalFinishGlass = this.glass.finishGlass;
    this.glass.finishGlass = () => {
      self._unregisterFormFromService();
      originalFinishGlass.call(self.glass);
    };
  }
}

window.HTMLProcessor = HTMLProcessor;