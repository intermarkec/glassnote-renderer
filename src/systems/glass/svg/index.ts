// Punto de entrada del parser de SVG.
//
// Orden de las etapas, que importa:
//   1. Esperar a que carguen las fuentes. Medir con la fuente equivocada da cortes de
//      linea equivocados, y la sustitucion no se puede deshacer despues.
//   2. Sustituir los %VAR%. Antes del wrap, porque el ancho a repartir es el del valor
//      final y no el del marcador.
//   3. Localizar el texto de noticias mientras el marcador todavia esta puesto, y recien
//      entonces sustituirlo.
//   4. Detectar las areas de texto: las de noticias van a la marquesina y el resto al
//      motor de composicion.

import { SvgVariables, SvgParam } from './svg-variables'
import { TextAreaFinder, TextArea } from './text-areas'
import { TextMeasurer } from './text-measurer'
import { TextLayout } from './text-layout'
import { NewsTicker, NewsRequest } from './news-ticker'

export { SvgVariables } from './svg-variables'
export { TextAreaFinder } from './text-areas'
export { TextMeasurer } from './text-measurer'
export { TextLayout } from './text-layout'
export { NewsTicker } from './news-ticker'
export type { SvgParam } from './svg-variables'
export type { TextArea, TextAlign } from './text-areas'
export type { NewsRequest, NewsResult } from './news-ticker'

export interface SvgTextReport {
  /** Variables sustituidas, contando texto y atributos. */
  substitutions: number
  /** Areas con marco encontradas. */
  areas: number
  /** Areas efectivamente recompuestas. */
  composed: number
  /** Areas que hubo que achicar para que entraran. */
  shrunk: number
  /** Marquesinas de noticias montadas. */
  tickers: number
}

export interface SvgTextOptions {
  /** Etiquetas que gestiona otro proceso y no hay que tocar. */
  skipLabels?: string[]
  /** Escala minima del cuerpo al reducir para que entre. */
  minFontScale?: number
  /** Milisegundos maximos de espera por las fuentes. */
  fontTimeout?: number
  /** Marquesina de noticias. La etiqueta se sustituye aparte, despues de localizarla. */
  news?: NewsRequest & { label: string }
}

export class SvgTextEngine {
  /**
   * Sustituye variables y compone los textos de un SVG ya insertado en el documento.
   * Tiene que estar insertado: la resolucion de estilos depende de getComputedStyle.
   */
  static async process(
    root: SVGSVGElement,
    params: SvgParam[],
    options?: SvgTextOptions
  ): Promise<SvgTextReport> {
    const settings = options || {}
    const news = settings.news
    const report: SvgTextReport = {
      substitutions: 0,
      areas: 0,
      composed: 0,
      shrunk: 0,
      tickers: 0
    }

    await this._fontsReady(settings.fontTimeout === undefined ? 3000 : settings.fontTimeout)

    // La etiqueta de noticias se salta en la pasada general: primero hay que ver que
    // elementos la llevan, porque despues de sustituirla ya no se los reconoce.
    const skip = (settings.skipLabels || []).slice()
    if (news && skip.indexOf(news.label) === -1) skip.push(news.label)

    try {
      report.substitutions = SvgVariables.substitute(root, params, skip)
    } catch (error) {
      console.error('[svg-text] fallo la sustitucion de variables:', error)
    }

    let newsElements: Element[] = []
    if (news) {
      try {
        newsElements = SvgVariables.elementsWithLabel(root, news.label)
        report.substitutions += SvgVariables.substitute(
          root,
          [{ label: news.label, value: news.text }]
        )
      } catch (error) {
        console.error('[svg-text] fallo la sustitucion de la noticia:', error)
      }
    }

    let areas: TextArea[] = []
    try {
      areas = TextAreaFinder.find(root)
    } catch (error) {
      console.error('[svg-text] fallo la deteccion de areas de texto:', error)
      return report
    }

    report.areas = areas.length
    if (areas.length === 0) return report

    const measurer = new TextMeasurer(root)
    const layout = new TextLayout(measurer, settings.minFontScale)
    const ticker = new NewsTicker(layout)

    try {
      for (let i = 0; i < areas.length; i++) {
        const area = areas[i]
        const esNoticia = news !== undefined && newsElements.indexOf(area.element) !== -1

        try {
          if (esNoticia && news) {
            if (ticker.apply(root, area, news).applied) report.tickers++
            continue
          }

          if (area.kind === 'plain' && !this._needsPlainRebuild(area)) continue

          const result = layout.apply(area)
          if (result.applied) {
            report.composed++
            if (result.scale < 1) report.shrunk++
          }
        } catch (error) {
          console.error('[svg-text] no se pudo componer un texto, se deja como estaba:', error)
        }
      }
    } finally {
      measurer.dispose()
    }

    return report
  }

  /**
   * Un <text> plano ya viene con sus lineas resueltas: solo se reconstruye si la
   * sustitucion metio un salto de linea que antes no estaba. Rehacerlo sin motivo
   * perderia el interlineado manual y los ajustes por glifo del original.
   */
  private static _needsPlainRebuild(area: TextArea): boolean {
    if (area.paragraphs.length < 2) return false

    for (let i = 1; i < area.paragraphs.length; i++) {
      if (area.paragraphs[i].anchorY === null) return true
    }
    return false
  }

  /**
   * Las fuentes web llegan tarde. Si se mide antes de que carguen, el wrap se calcula
   * con la fuente de reemplazo y las lineas salen mal. Se espera, pero con tope: mas
   * vale un corte imperfecto que un glass que no aparece.
   */
  private static _fontsReady(timeout: number): Promise<void> {
    const fonts = (document as any).fonts
    if (!fonts || !fonts.ready || timeout <= 0) return Promise.resolve()

    return new Promise<void>(function (resolve) {
      let settled = false
      const done = function () {
        if (settled) return
        settled = true
        resolve()
      }

      setTimeout(done, timeout)
      fonts.ready.then(done).catch(done)
    })
  }
}
