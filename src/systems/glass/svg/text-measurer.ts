// Medicion de texto para el motor de wrap.
//
// SVG no parte lineas solo: para saber donde cortar hay que medir cada palabra con la
// fuente real. La via directa seria getComputedTextLength() sobre un <text> de prueba,
// pero obliga a un reflow por medicion y en una plantilla con parrafos largos eso son
// miles de reflows. Canvas 2D mide sin tocar el layout, asi que se usa canvas por
// defecto y el <text> oculto solo como respaldo.

import { SVG_NS } from './style-utils'

/** Valor improbable que sirve para saber si el canvas acepto la fuente pedida. */
const SENTINEL_FONT = '7.3px monospace'

export interface FontSpec {
  fontFamily: string
  fontSize: number
  fontStyle: string
  fontWeight: string
  fontVariant: string
  letterSpacing: number
  wordSpacing: number
}

export class TextMeasurer {
  private _ctx: CanvasRenderingContext2D | null = null
  private _supportsLetterSpacing = false
  private _supportsWordSpacing = false
  private _fallbackHost: SVGSVGElement | null = null
  private _fallbackText: SVGTextElement | null = null
  private _widths: Record<string, number> = {}
  private _metrics: Record<string, { ascent: number; descent: number }> = {}

  constructor(fallbackRoot?: SVGSVGElement | null) {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (ctx) {
        this._ctx = ctx
        this._supportsLetterSpacing = 'letterSpacing' in ctx
        this._supportsWordSpacing = 'wordSpacing' in ctx
      }
    } catch (error) {
      console.warn('[svg-text] canvas no disponible, se mide con getComputedTextLength:', error)
    }

    if (!this._ctx && fallbackRoot) {
      this._buildFallback(fallbackRoot)
    }
  }

  /** Ancho de un texto en unidades de usuario. */
  measure(text: string, font: FontSpec): number {
    if (!text) return 0

    const key = this._key(font) + ' ' + text
    const cached = this._widths[key]
    if (cached !== undefined) return cached

    const width = this._ctx ? this._measureWithCanvas(text, font) : this._measureWithSvg(text, font)
    this._widths[key] = width
    return width
  }

  /**
   * Ascendente como fraccion del em, normalizando ascendente mas descendente a 1.
   * Es la proporcion con la que Inkscape coloca la primera linea base dentro del marco.
   *
   * Se mide a 1000px porque el navegador redondea las metricas a enteros: a 14px el
   * error del redondeo seria de casi un pixel, y a 1000px el valor coincide al decimal
   * con el ascendente y el descendente hhea de la fuente.
   *
   * Limite conocido: Inkscape usa las metricas OS/2 typo y el navegador solo expone las
   * hhea (emHeightAscent no esta implementado en Chromium). En las fuentes donde ambas
   * coinciden, que son las Noto y la mayoria de las modernas, la linea base cae en el
   * mismo sitio que en Inkscape. En las que difieren, como DejaVu Sans, queda 0.04 em
   * mas abajo: medio pixel a cuerpo 16.
   */
  ascentFraction(font: FontSpec): number {
    const probe: FontSpec = {
      fontFamily: font.fontFamily,
      fontSize: 1000,
      fontStyle: font.fontStyle,
      fontWeight: font.fontWeight,
      fontVariant: font.fontVariant,
      letterSpacing: 0,
      wordSpacing: 0
    }

    const metrics = this._fontMetrics(probe)
    const total = metrics.ascent + metrics.descent
    return total > 0 ? metrics.ascent / total : 0.8
  }

  /** Libera el <text> de respaldo si se creo. */
  dispose(): void {
    if (this._fallbackHost && this._fallbackHost.parentNode) {
      this._fallbackHost.parentNode.removeChild(this._fallbackHost)
    }
    this._fallbackHost = null
    this._fallbackText = null
  }

  private _fontMetrics(font: FontSpec): { ascent: number; descent: number } {
    const key = this._key(font)
    const cached = this._metrics[key]
    if (cached !== undefined) return cached

    // Proporciones tipicas de una sans humanista, por si no hay canvas o el navegador
    // no expone las metricas de la caja de fuente.
    let metrics = { ascent: font.fontSize * 0.8, descent: font.fontSize * 0.2 }

    if (this._ctx) {
      this._applyFont(this._ctx, font)
      try {
        const measured = this._ctx.measureText('Hxg')
        const ascent = measured.fontBoundingBoxAscent
        const descent = measured.fontBoundingBoxDescent
        if (typeof ascent === 'number' && isFinite(ascent) && ascent > 0) {
          metrics = { ascent: ascent, descent: isFinite(descent) ? descent : font.fontSize * 0.2 }
        }
      } catch (error) {
        console.warn('[svg-text] sin metricas de fuente, se usan proporciones por defecto:', error)
      }
    }

    this._metrics[key] = metrics
    return metrics
  }

  private _measureWithCanvas(text: string, font: FontSpec): number {
    const ctx = this._ctx as CanvasRenderingContext2D
    this._applyFont(ctx, font)

    let width = ctx.measureText(text).width

    // Si el navegador no soporta el espaciado por contexto, se suma a mano.
    if (!this._supportsLetterSpacing && font.letterSpacing) {
      width += font.letterSpacing * text.length
    }
    if (!this._supportsWordSpacing && font.wordSpacing) {
      width += font.wordSpacing * this._countSpaces(text)
    }

    return width
  }

  private _measureWithSvg(text: string, font: FontSpec): number {
    if (!this._fallbackText) return text.length * font.fontSize * 0.5

    const node = this._fallbackText
    node.setAttribute(
      'style',
      'font-family:' + font.fontFamily +
      ';font-size:' + font.fontSize + 'px' +
      ';font-style:' + font.fontStyle +
      ';font-weight:' + font.fontWeight +
      ';font-variant:' + font.fontVariant +
      ';letter-spacing:' + font.letterSpacing + 'px' +
      ';word-spacing:' + font.wordSpacing + 'px' +
      ';white-space:pre'
    )
    node.textContent = text

    try {
      return node.getComputedTextLength()
    } catch (error) {
      console.warn('[svg-text] getComputedTextLength fallo:', error)
      return text.length * font.fontSize * 0.5
    }
  }

  /**
   * Aplica la fuente al contexto probando de la forma mas completa a la mas simple.
   * Una cadena invalida no lanza error: deja ctx.font como estaba, y se detecta
   * comparando contra un centinela. El ultimo candidato es siempre valido, asi que
   * el contexto nunca queda midiendo con un cuerpo que no es el pedido.
   */
  private _applyFont(ctx: CanvasRenderingContext2D, font: FontSpec): void {
    const family = font.fontFamily || 'sans-serif'
    const size = Math.round(font.fontSize * 1000) / 1000
    const candidates = [
      this._fontShorthand(font.fontStyle, font.fontVariant, font.fontWeight, size, family),
      this._fontShorthand(font.fontStyle, 'normal', font.fontWeight, size, family),
      size + 'px ' + family,
      size + 'px sans-serif'
    ]

    for (let i = 0; i < candidates.length; i++) {
      ctx.font = SENTINEL_FONT
      ctx.font = candidates[i]
      if (candidates[i] === SENTINEL_FONT || ctx.font !== SENTINEL_FONT) break
    }

    const anyCtx = ctx as any
    if (this._supportsLetterSpacing) {
      anyCtx.letterSpacing = (font.letterSpacing || 0) + 'px'
    }
    if (this._supportsWordSpacing) {
      anyCtx.wordSpacing = (font.wordSpacing || 0) + 'px'
    }
  }

  private _fontShorthand(
    style: string,
    variant: string,
    weight: string,
    size: number,
    family: string
  ): string {
    const parts: string[] = []
    if (style && style !== 'normal') parts.push(style)
    if (variant && variant !== 'normal') parts.push(variant)
    if (weight && weight !== 'normal' && weight !== '400') parts.push(weight)
    parts.push(size + 'px')
    parts.push(family)
    return parts.join(' ')
  }

  private _countSpaces(text: string): number {
    let count = 0
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 32) count++
    }
    return count
  }

  private _key(font: FontSpec): string {
    return [
      font.fontFamily,
      font.fontSize,
      font.fontStyle,
      font.fontWeight,
      font.fontVariant,
      font.letterSpacing,
      font.wordSpacing
    ].join('|')
  }

  private _buildFallback(root: SVGSVGElement): void {
    try {
      const host = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
      host.setAttribute('width', '0')
      host.setAttribute('height', '0')
      host.setAttribute('style', 'position:absolute;left:-9999px;top:-9999px;overflow:hidden')

      const text = document.createElementNS(SVG_NS, 'text') as SVGTextElement
      host.appendChild(text)

      const parent = root.parentNode || document.body
      parent.appendChild(host)

      this._fallbackHost = host
      this._fallbackText = text
    } catch (error) {
      console.warn('[svg-text] no se pudo crear el medidor de respaldo:', error)
    }
  }
}
