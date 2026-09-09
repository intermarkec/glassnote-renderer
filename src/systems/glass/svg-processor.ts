import { ScaleCalculator } from './scale-calculator';
import { FileLoader } from './file-loader';
import { SvgTextEngine, SvgParam, NewsRequest } from './svg/index';

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
        news: this._newsRequest(data)
      });

      if (report.composed > 0 || report.substitutions > 0 || report.tickers > 0) {
        console.log(
          '[svg] variables: ' + report.substitutions +
          ' | areas de texto: ' + report.areas +
          ' | compuestas: ' + report.composed +
          ' | reducidas para que entren: ' + report.shrunk +
          ' | marquesinas: ' + report.tickers
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

  /**
   * Los datos de la marquesina, o undefined si el mensaje no trae noticia.
   * El motor se encarga de localizar el texto marcado con %NEWS%, medirlo y animarlo.
   */
  private _newsRequest(data: any): (NewsRequest & { label: string }) | undefined {
    if (!data || !data.parameters) return undefined;

    try {
      const parameters = typeof data.parameters === 'string'
        ? JSON.parse(data.parameters)
        : data.parameters;
      if (!Array.isArray(parameters)) return undefined;

      const newsParam = this._findParameter(parameters, '%NEWS%');
      if (!newsParam || newsParam.value === undefined || newsParam.value === null) {
        return undefined;
      }

      const speedParam = this._findParameter(parameters, '%SPEED%');
      const loopParam = this._findParameter(parameters, '%LOOP%');
      const speed = speedParam ? parseFloat(speedParam.value) : NaN;
      const self = this;

      return {
        label: '%NEWS%',
        // Se conserva el formato de siempre: guion delante y las noticias encadenadas.
        text: '- ' + String(newsParam.value).replace(/\n/g, '  - '),
        speed: isFinite(speed) && speed > 0 ? speed : 50,
        loop: loopParam ? String(loopParam.value) !== 'false' : true,
        glassId: String(data.id),
        onFinish: function () {
          self.glass.finishGlass();
        }
      };
    } catch (error) {
      console.error('[svg] no se pudo leer la noticia:', error);
      return undefined;
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

  private _isCorsOrCspError(error: Error): boolean {
    if (!error.message) return false;
    
    return error.message.includes('CORS') ||
           error.message.includes('cross-origin') ||
           error.message.includes('Content Security Policy') ||
           error.message.includes('CSP');
  }
}

window.SVGProcessor = SVGProcessor;