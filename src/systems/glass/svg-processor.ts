import { ScaleCalculator } from './scale-calculator';
import { asegurarFuentes, familiasQuePide, origenDeFuentes } from '../../services/fuentes';
import { FileLoader } from './file-loader';
import { SvgTextEngine, SvgParam, NewsRequest } from './svg/index';

/** Píxeles por segundo que corresponden al 100% del control de velocidad. */
const VELOCIDAD_MAXIMA = 600;

/** Hasta dónde llega el control del editor: el 100% es la referencia, no el techo. */
const PORCENTAJE_MAXIMO = 150;

// Cuanto vale en px una unidad absoluta de CSS. El SVG de Inkscape trae el tamano en
// milimetros —`width="508mm"`— y un parseFloat pelado se queda con el 508 y tira la
// unidad, asi que un arte pensado para 1920 px se dibujaba de 508 y ocupaba un cuarto de
// la pantalla. 508 mm son exactamente 1920 px al 96 dpi que asume CSS.
const PX_POR_UNIDAD: { [unidad: string]: number } = {
  '': 1,
  px: 1,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
  pt: 96 / 72,
  pc: 16
};

/**
 * El atributo width/height de un <svg> resuelto a px.
 *
 * Devuelve 0 —y quien llama se va al viewBox— cuando la medida no se puede resolver sola:
 * un porcentaje o una unidad relativa (em, rem, vw) dependen del contenedor o de la
 * tipografia, y aca todavia no hay ninguno de los dos. Antes esas tambien caian en el
 * parseFloat, y un `width="100%"` terminaba siendo un arte de 100 px.
 */
function resolverLongitud(valor: string | null): number {
  if (!valor) return 0;

  const partes = valor.trim().match(/^([+-]?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)\s*([a-z%]*)$/i);
  if (!partes) return 0;

  const numero = parseFloat(partes[1]);
  if (!isFinite(numero) || numero <= 0) return 0;

  const factor = PX_POR_UNIDAD[partes[2].toLowerCase()];
  if (factor === undefined) return 0;

  return numero * factor;
}

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
      // Las tipografías ANTES de dibujar: el motor de texto mide para acomodar y reducir,
      // y midiendo con la fuente equivocada acomoda para una que no es la que se va a ver.
      await asegurarFuentes(familiasQuePide(svgContent), origenDeFuentes(data?.baseUrl));
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

    // El contenido del glass todavia no esta en el documento en este punto: el sistema
    // lo inserta recien cuando este metodo resuelve. Y getComputedStyle sobre un
    // elemento suelto devuelve vacio, asi que el texto se mediria con la fuente por
    // defecto del navegador en vez de la del arte, y saldrian mal tanto los cortes de
    // linea como la duracion de la marquesina. Se ancla a un host invisible mientras
    // dura la composicion y se devuelve a su sitio al terminar.
    const host = glassContent.isConnected ? null : this._attachOffscreen(glassContent);
    try {
      await this._processText(svgElement, data);
    } finally {
      if (host) this._detachOffscreen(host, glassContent);
    }

    this._configureSvgDimensions(svgElement, wrapper);
  }

  /** Ancla el contenido fuera de la vista para poder resolver estilos y medir. */
  private _attachOffscreen(glassContent: HTMLElement): HTMLElement {
    const host = document.createElement('div');
    host.setAttribute('data-glass-medicion', 'true');
    host.style.cssText =
      'position:fixed;left:-99999px;top:0;width:100vw;height:100vh;' +
      'overflow:hidden;pointer-events:none;opacity:0';

    document.body.appendChild(host);
    host.appendChild(glassContent);
    return host;
  }

  /** Devuelve el contenido a su estado suelto, que es como lo espera el sistema. */
  private _detachOffscreen(host: HTMLElement, glassContent: HTMLElement): void {
    if (glassContent.parentNode === host) host.removeChild(glassContent);
    if (host.parentNode) host.parentNode.removeChild(host);
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

      svgWidth = resolverLongitud(wAttr);
      svgHeight = resolverLongitud(hAttr);

      if (svgWidth > 0 && svgHeight > 0) {
        if (!svgElement.getAttribute('viewBox')) {
          // Sin viewBox una unidad de usuario es un px, asi que el lienzo en unidades
          // de usuario mide lo mismo que el tamano que se acaba de resolver.
          svgElement.setAttribute(
            'viewBox',
            '0 0 ' + svgWidth + ' ' + svgHeight
          );
        }
      } else {
        const vb = svgElement.getAttribute('viewBox');
        if (vb) {
          const parts = vb.split(/[\s,]+/).map(Number);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            svgWidth = parts[2];
            svgHeight = parts[3];

            // Sin width ni height el <svg> no tiene tamano propio, y dentro de un
            // contenedor que se ajusta al contenido eso se resuelve en cero. El
            // dimensionado de mas abajo espera a que el elemento mida algo antes de
            // asignarle su tamano, asi que sin esto nunca arranca y el glass no se ve.
            // Los export de Illustrator son siempre asi: solo viewBox.
            svgElement.setAttribute('width', String(svgWidth));
            svgElement.setAttribute('height', String(svgHeight));
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
      const self = this;

      return {
        label: '%NEWS%',
        // Se conserva el formato de siempre: guion delante y las noticias encadenadas.
        text: '- ' + String(newsParam.value).replace(/\n/g, '  - '),
        speed: this._velocidadEnPixeles(speedParam ? speedParam.value : undefined),
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

  /**
   * El editor guarda %SPEED% como un PORCENTAJE (0 a 100), no como píxeles por segundo.
   * Antes se usaba el número tal cual, y eso dejaba la marquesina inservible: al 50 —el
   * valor por defecto— un texto de noticias normal tardaba 149 segundos en cruzar una
   * pantalla de 1920, o sea que con la duración habitual del mensaje nunca se lo veía
   * pasar y mover el control no cambiaba nada apreciable.
   *
   * Ahora el 100% son VELOCIDAD_MAXIMA px/s: ese mismo texto cruza en unos 12 segundos.
   * Y el 0% es quieto, que es lo que cualquiera entiende al ver un cero.
   */
  private _velocidadEnPixeles(valor: string | undefined): number {
    const porcentaje = valor !== undefined ? parseFloat(valor) : NaN;
    if (!isFinite(porcentaje)) return VELOCIDAD_MAXIMA / 2;
    // El tope es 150 y no 100: el control del editor llega hasta ahí, o sea que el 100%
    // no es el máximo sino la referencia. Por abajo se admite el 0 aunque el editor ya no
    // lo ofrezca, porque puede venir de un mensaje viejo o de la API.
    return (Math.max(0, Math.min(PORCENTAJE_MAXIMO, porcentaje)) / 100) * VELOCIDAD_MAXIMA;
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