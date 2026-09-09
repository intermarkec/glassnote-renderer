import { ScaleCalculator } from './scale-calculator';
import { FileLoader } from './file-loader';
import { SvgTextEngine, SvgParam } from './svg/index';

interface GlassInstance {
  finishGlass: () => void;
}

export class SVGProcessor {
  private glass: GlassInstance;
  private scaleCalculator: ScaleCalculator;

  constructor(glassInstance: GlassInstance) {
    this.glass = glassInstance;
    this.scaleCalculator = new ScaleCalculator();
  }

  async process(glassContent: HTMLElement, data: any, upload: any): Promise<void> {
    const svgUrl = data.baseUrl + upload.path;

    try {
      const svgContent = await FileLoader.loadText(svgUrl);
      await this._createSvgElement(glassContent, svgContent, data);
    } catch (svgError) {
      console.error('Error processing SVG:', svgError);

      if (this._isCorsOrCspError(svgError as Error)) {
        console.warn('CORS/CSP issue detected with SVG loading.');
      }

      throw svgError;
    }
  }

  private async _createSvgElement(glassContent: HTMLElement, svgContent: string, data: any): Promise<void> {
    const svgElement = this._parseSvg(svgContent);
    if (!svgElement) {
      throw new Error('No SVG element found in content');
    }

    const wrapper = document.createElement('div');
    wrapper.appendChild(svgElement);
    glassContent.appendChild(wrapper);

    svgElement.style.display = 'block';
    svgElement.style.transform = 'translateZ(0)';

    // Va con el SVG ya insertado: la composicion resuelve estilos con getComputedStyle
    // y mide con las fuentes reales, y ninguna de las dos cosas funciona fuera del DOM.
    await this._processText(svgElement, data);

    this._configureSvgDimensions(svgElement, wrapper);
    this._processNewsElements(svgElement, data);
  }

  /**
   * Parsea el SVG. Primero como XML, porque es lo unico que conserva los nombres de
   * etiqueta de Inkscape: el parser de HTML baja <flowRoot> a <flowroot> y <flowPara>
   * a <flowpara>. Si el archivo no es XML bien formado, cosa frecuente en los SVG que
   * escribe una IA, se cae al parser de HTML, que es tolerante y arregla el markup.
   */
  private _parseSvg(svgContent: string): SVGSVGElement | null {
    try {
      const doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
      const failed = doc.getElementsByTagName('parsererror').length > 0;
      const root = doc.documentElement;

      if (!failed && root && root.nodeName.toLowerCase() === 'svg') {
        return document.importNode(root, true) as unknown as SVGSVGElement;
      }

      console.warn('[svg] el archivo no es XML valido, se reintenta con el parser de HTML');
    } catch (parseError) {
      console.warn('[svg] DOMParser fallo, se reintenta con el parser de HTML:', parseError);
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = svgContent;
    return wrapper.querySelector('svg');
  }

  private async _processText(svgElement: SVGSVGElement, data: any): Promise<void> {
    try {
      const report = await SvgTextEngine.process(svgElement, this._collectParams(data), {
        // %NEWS% lo consume la marquesina de mas abajo, que necesita ver el marcador.
        skipLabels: ['%NEWS%']
      });

      if (report.composed > 0 || report.substitutions > 0) {
        console.log(
          '[svg] variables: ' + report.substitutions +
          ' | areas de texto: ' + report.areas +
          ' | compuestas: ' + report.composed +
          ' | reducidas para que entren: ' + report.shrunk
        );
      }
    } catch (textError) {
      console.error('[svg] fallo la composicion de texto, se dibuja el SVG tal cual:', textError);
    }
  }

  /**
   * Los parametros del mensaje, mas %VERSION%.
   * Hasta ahora en SVG solo se sustituian %VERSION% y %NEWS%, y cualquier otra variable
   * del arte se quedaba a la vista con el marcador crudo.
   */
  private _collectParams(data: any): SvgParam[] {
    const appVersion = window.appVersion || '';
    const rendererVersion = window.rendererVersion || 'TEMPORAL';
    const params: SvgParam[] = [
      { label: '%VERSION%', value: appVersion + ',' + rendererVersion }
    ];

    if (!data || !data.parameters) return params;

    try {
      const parsed = typeof data.parameters === 'string'
        ? JSON.parse(data.parameters)
        : data.parameters;

      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length; i++) {
          const param = parsed[i];
          if (param && param.label) {
            params.push({ label: param.label, value: param.value });
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        // La API manda un arreglo, pero el editor los maneja indexados por etiqueta.
        const keys = Object.keys(parsed);
        for (let i = 0; i < keys.length; i++) {
          const param = parsed[keys[i]];
          const label = param && param.label ? param.label : keys[i];
          const value = param && param.value !== undefined ? param.value : param;
          params.push({ label: label, value: value });
        }
      }
    } catch (error) {
      console.error('[svg] no se pudieron leer los parametros del mensaje:', error);
    }

    return params;
  }

  private _configureSvgDimensions(svgElement: SVGElement, wrapper: HTMLDivElement): void {
    const self = this;
    let svgWidth = 0;
    let svgHeight = 0;

    try {
      const wAttr = svgElement.getAttribute('width');
      const hAttr = svgElement.getAttribute('height');

      if (wAttr && hAttr) {
        svgWidth = parseFloat(wAttr);
        svgHeight = parseFloat(hAttr);
        if (!svgElement.getAttribute('viewBox')) {
          svgElement.setAttribute(
            'viewBox',
            '0 0 ' + svgWidth + ' ' + svgHeight
          );
        }
      } else {
        const vb = svgElement.getAttribute('viewBox');
        if (vb) {
          const parts = vb.split(/\s+/).map(Number);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            svgWidth = parts[2];
            svgHeight = parts[3];
          }
        }
      }

      if (svgWidth > 0 && svgHeight > 0) {
        this._applySvgDimensions(svgElement, wrapper, svgWidth, svgHeight);
      }
    } catch (svgDimError) {
      console.warn('Error processing SVG dimensions:', svgDimError);
      this._applyDefaultSvgDimensions(svgElement);
    }
  }

  private _applySvgDimensions(svgElement: SVGElement, wrapper: HTMLDivElement, svgWidth: number, svgHeight: number): void {
    const self = this;
    const scaleFactor = this.scaleCalculator.calculateScaleFactor();
    
    const applyDimensions = function() {
      const svgRect = svgElement.getBoundingClientRect();
      if (svgRect.width === 0 || svgRect.height === 0) {
        requestAnimationFrame(applyDimensions);
        return;
      }

      const dimensions = self.scaleCalculator.calculateScaledDimensions(
        svgWidth, 
        svgHeight, 
        scaleFactor
      );

      wrapper.style.width = dimensions.width + 'px';
      wrapper.style.height = dimensions.height + 'px';
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';
      svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    };

    requestAnimationFrame(applyDimensions);
  }

  private _applyDefaultSvgDimensions(svgElement: SVGElement): void {
    const applyDefaults = function() {
      const svgRect = svgElement.getBoundingClientRect();
      if (svgRect.width === 0 || svgRect.height === 0) {
        requestAnimationFrame(applyDefaults);
        return;
      }

      const maxWidth = window.innerWidth;
      const maxHeight = window.innerHeight;
      svgElement.style.width = maxWidth + 'px';
      svgElement.style.height = maxHeight + 'px';
    };

    requestAnimationFrame(applyDefaults);
  }

  private _processNewsElements(svgElement: SVGElement, data: any): void {
    try {
      const parameters = JSON.parse(data.parameters);
      const newsParam = this._findParameter(parameters, '%NEWS%');
      const speedParam = this._findParameter(parameters, '%SPEED%');
      const loopParam = this._findParameter(parameters, '%LOOP%');
      
      const news = newsParam ? newsParam.value.replace(/\n/g, '  - ') : '';
      const speed = speedParam ? parseFloat(speedParam.value) : 1;
      const loop = loopParam ? loopParam.value : 'true';

      const newsElements = this._getNewsElements(svgElement);
      this._animateNewsElements(newsElements, news, speed, loop, data.id);
      
    } catch (newsError) {
      console.warn('Error processing NEWS elements:', newsError);
    }
  }

  private _findParameter(parameters: any[], label: string): any {
    for (let i = 0; i < parameters.length; i++) {
      if (parameters[i].label === label) {
        return parameters[i];
      }
    }
    return null;
  }

  private _getNewsElements(svgElement: SVGElement): NodeListOf<SVGTextElement> | HTMLCollectionOf<SVGTextElement> {
    let newsElements: NodeListOf<SVGTextElement> | HTMLCollectionOf<SVGTextElement>;
    try {
      newsElements = svgElement.querySelectorAll('text');
    } catch (queryError) {
      console.warn('querySelectorAll not supported, using fallback');
      if (svgElement.getElementsByTagName) {
        newsElements = svgElement.getElementsByTagName('text') as HTMLCollectionOf<SVGTextElement>;
      } else {
        newsElements = document.querySelectorAll('text');
      }
    }
    return newsElements;
  }

  private _animateNewsElements(newsElements: NodeListOf<SVGTextElement> | HTMLCollectionOf<SVGTextElement>, news: string, speed: number, loop: string, glassId: string): void {
    const self = this;
    
    for (let i = 0; i < newsElements.length; i++) {
      const element = newsElements[i];
      if (element.textContent && element.textContent.indexOf('%NEWS%') !== -1) {
        this._animateSingleNewsElement(element, news, speed, loop, glassId);
      }
    }
  }

  private _animateSingleNewsElement(element: SVGTextElement, news: string, speed: number, loop: string, glassId: string): void {
    const self = this;
    
    const originalText = element.textContent || '';
    element.textContent = originalText.replace('%NEWS%', '- ' + news);

    const parentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    parentGroup.appendChild(element.cloneNode(true));
    element.parentNode!.replaceChild(parentGroup, element);

    setTimeout(function() {
      try {
        self._setupNewsAnimation(parentGroup, speed, loop, glassId);
      } catch (animationError) {
        console.warn('Error setting up NEWS animation:', animationError);
      }
    }, 50);
  }

  private _setupNewsAnimation(parentGroup: SVGGElement, speed: number, loop: string, glassId: string): void {
    const textNode = parentGroup.querySelector('text');
    let textWidth = 200;
    let groupX = 0;
    
    try {
      textWidth = textNode!.getBBox().width;
      groupX = parentGroup.getBBox().x;
    } catch (bboxError) {
      console.warn('getBBox not supported, using fallback values');
      textWidth = 200;
      groupX = 0;
    }
    
    const distance = groupX + textWidth + 10;
    const duration = distance / speed;

    try {
      this._createSvgAnimation(parentGroup, distance, duration, loop, glassId);
    } catch (svgAnimError) {
      console.warn('SVG animation not supported in this browser');
    }
  }

  private _createSvgAnimation(parentGroup: SVGGElement, distance: number, duration: number, loop: string, glassId: string): void {
    const self = this;
    
    const animateElement = document.createElementNS('http://www.w3.org/2000/svg', 'animateTransform');
    animateElement.setAttribute('id', 'moveAnim_' + glassId);
    animateElement.setAttribute('attributeName', 'transform');
    animateElement.setAttribute('attributeType', 'XML');
    animateElement.setAttribute('type', 'translate');
    animateElement.setAttribute('from', '0 0');
    animateElement.setAttribute('to', '-' + distance + ' 0');
    animateElement.setAttribute('dur', duration + 's');
    animateElement.setAttribute('repeatCount', loop === 'false' ? '1' : 'indefinite');
    
    if (loop === 'false') {
      animateElement.setAttribute('fill', 'freeze');
      if (animateElement.addEventListener) {
        animateElement.addEventListener('endEvent', function() {
          parentGroup.setAttribute('opacity', '0');
          self.glass.finishGlass();
        });
      }
    }
    
    animateElement.setAttribute('begin', '0s');
    parentGroup.appendChild(animateElement);

    const fade = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    fade.setAttribute('id', 'fadeAnim_' + glassId);
    fade.setAttribute('attributeName', 'opacity');
    fade.setAttribute('values', '0;1;1;0');
    fade.setAttribute('keyTimes', 
      '0;' + (1 / duration).toFixed(3) + ';' + ((duration - 1) / duration).toFixed(3) + ';1'
    );
    fade.setAttribute('dur', duration + 's');
    fade.setAttribute('repeatCount', loop === 'false' ? '1' : 'indefinite');
    
    if (loop === 'false') {
      fade.setAttribute('fill', 'freeze');
    }

    parentGroup.appendChild(fade);
  }

  private _isCorsOrCspError(error: Error): boolean {
    if (!error.message) return false;
    
    return error.message.includes('CORS') ||
           error.message.includes('cross-origin') ||
           error.message.includes('Content Security Policy') ||
           error.message.includes('CSP');
  }
}

window.SVGProcessor = SVGProcessor;