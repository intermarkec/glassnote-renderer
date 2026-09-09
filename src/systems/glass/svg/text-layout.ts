// Motor de composicion: parte los parrafos en lineas y reconstruye el elemento.
//
// SVG no tiene wrap. Un <text> se dibuja siempre en una sola linea y las dos formas de
// texto con marco que existen (flowRoot y shape-inside) no las implementa ningun
// navegador. Asi que hay que calcular los cortes a mano: medir cada palabra con la
// fuente real, llenar lineas hasta el ancho util, y emitir un <tspan> por linea con su
// x e y ya resueltos.
//
// Alineacion:
//   izquierda / centro / derecha  -> text-anchor + la x que corresponda del marco
//   justificado                   -> text-anchor start y el sobrante repartido entre los
//                                    espacios de la linea via word-spacing. La ultima
//                                    linea de cada parrafo no se justifica, como en
//                                    cualquier tipografia.
//
// Si el texto no entra en el alto del marco se reduce el cuerpo hasta que entre, por
// busqueda binaria sobre la escala. Nunca se descarta contenido.

import { SVG_NS, XML_NS, resolveLineHeight } from './style-utils'
import { TextMeasurer, FontSpec } from './text-measurer'
import { TextArea, TextAlign, Paragraph, TextAreaFinder } from './text-areas'

/** Propiedades que describen el marco y que no deben sobrevivir en el texto emitido. */
const DROPPED_PROPERTIES = [
  'shape-inside',
  'shape-outside',
  'shape-padding',
  'shape-margin',
  'shape-subtract',
  'inline-size',
  'text-align',
  'white-space'
]

const DROPPED_ATTRIBUTES = ['x', 'y', 'dx', 'dy', 'rotate', 'style', 'textLength', 'lengthAdjust']

interface RunStyle {
  font: FontSpec
  lineHeight: number
  style: string
}

interface Token {
  text: string
  isSpace: boolean
  run: number
}

interface Line {
  tokens: Token[]
  width: number
  height: number
  lastOfParagraph: boolean
}

export interface SingleLine {
  text: SVGTextElement
  width: number
  baseline: number
  lineHeight: number
  ascent: number
}

export interface LayoutResult {
  applied: boolean
  scale: number
  lines: number
}

export class TextLayout {
  private _measurer: TextMeasurer
  private _minScale: number

  constructor(measurer: TextMeasurer, minScale?: number) {
    this._measurer = measurer
    this._minScale = minScale === undefined ? 0.15 : minScale
  }

  /**
   * Compone un area y sustituye el elemento original por el <text> resultante.
   * Devuelve applied=false si no habia nada que componer.
   */
  apply(area: TextArea): LayoutResult {
    const empty: LayoutResult = { applied: false, scale: 1, lines: 0 }

    const parent = area.element.parentNode
    if (!parent) return empty

    const styles = this._resolveRunStyles(area)
    if (styles.length === 0) return empty

    const wraps = area.kind !== 'plain' && area.width > 0
    const scale = wraps ? this._fitScale(area, styles) : 1
    const lines = this._composeAll(area, styles, scale, wraps)
    if (lines.length === 0) return empty

    const replacement = this._render(area, styles, lines, scale, wraps)
    parent.replaceChild(replacement, area.element)

    return { applied: true, scale: scale, lines: lines.length }
  }

  /**
   * Compone el area en una sola linea y devuelve el <text> sin insertarlo, junto con su
   * ancho medido. Lo usa la marquesina de noticias: necesita el texto con los estilos de
   * cada tramo intactos y, sobre todo, el ancho exacto, que es lo que fija la duracion
   * del recorrido. Medido asi no hace falta getBBox ni esperar a un setTimeout.
   */
  composeSingleLine(area: TextArea, separator: string): SingleLine | null {
    const styles = this._resolveRunStyles(area)
    if (styles.length === 0) return null

    // Los tramos vienen numerados por parrafo. Al juntar todo en una linea hay que
    // aplanar los estilos y correr el indice de cada token, o el tramo del segundo
    // parrafo terminaria pintado con el estilo del primero.
    const flatStyles: RunStyle[] = []
    const tokens: Token[] = []

    for (let p = 0; p < area.paragraphs.length; p++) {
      const base = flatStyles.length
      for (let r = 0; r < styles[p].length; r++) flatStyles.push(styles[p][r])

      if (p > 0 && separator && flatStyles.length > 0) {
        tokens.push({ text: separator, isSpace: false, run: base })
      }

      const propios = this._tokenize(area.paragraphs[p], true)
      for (let i = 0; i < propios.length; i++) {
        tokens.push({ text: propios[i].text, isSpace: propios[i].isSpace, run: base + propios[i].run })
      }
    }

    if (flatStyles.length === 0) return null

    const trimmed = this._trimSpaces(tokens)
    let width = 0
    for (let i = 0; i < trimmed.length; i++) {
      const style = flatStyles[trimmed[i].run] || flatStyles[0]
      width += this._measurer.measure(trimmed[i].text, style.font)
    }

    const style = flatStyles[0]
    const lineHeight = style.lineHeight
    const ascent = style.font.fontSize * this._measurer.ascentFraction(style.font)
    const baseline = area.firstBaseline !== null
      ? area.firstBaseline
      : area.top + ascent + (lineHeight - style.font.fontSize) / 2

    const line: Line = { tokens: trimmed, width: width, height: lineHeight, lastOfParagraph: true }
    const text = document.createElementNS(SVG_NS, 'text') as SVGTextElement
    this._copyAttributes(area.element, text)
    text.setAttributeNS(XML_NS, 'xml:space', 'preserve')
    text.setAttribute('style', this._rootStyle(area, styles, 1, false))
    text.appendChild(this._renderLine(line, flatStyles, area, area.left, baseline, 1, false))

    return {
      text: text,
      width: width,
      baseline: baseline,
      lineHeight: lineHeight,
      ascent: ascent
    }
  }

  // ------------------------------------------------------------------ estilos

  /**
   * Un estilo por parrafo y tramo. Se resuelve con getComputedStyle sobre el elemento
   * mas interno, que es lo unico que da bien la herencia, los bloques <style>
   * embebidos y las unidades relativas.
   */
  private _resolveRunStyles(area: TextArea): RunStyle[][] {
    const perParagraph: RunStyle[][] = []

    for (let p = 0; p < area.paragraphs.length; p++) {
      const paragraph = area.paragraphs[p]
      const styles: RunStyle[] = []

      for (let r = 0; r < paragraph.runs.length; r++) {
        const chain = paragraph.runs[r].styleChain
        const source = chain.length > 0 ? chain[chain.length - 1] : area.element
        styles.push(this._runStyle(source, chain))
      }

      perParagraph.push(styles)
    }

    return perParagraph
  }

  private _runStyle(source: Element, chain: Element[]): RunStyle {
    const computed = this._computed(source)

    const fontSize = this._number(computed ? computed.fontSize : '', 16)
    const font: FontSpec = {
      fontFamily: (computed && computed.fontFamily) || 'sans-serif',
      fontSize: fontSize,
      fontStyle: (computed && computed.fontStyle) || 'normal',
      fontWeight: (computed && computed.fontWeight) || 'normal',
      fontVariant: (computed && computed.fontVariant) || 'normal',
      letterSpacing: this._number(computed ? computed.letterSpacing : '', 0),
      wordSpacing: this._number(computed ? computed.wordSpacing : '', 0)
    }

    const parts: string[] = []
    for (let i = 0; i < chain.length; i++) {
      const style = TextAreaFinder.styleOf(chain[i])
      if (style) parts.push(style)
    }

    return {
      font: font,
      lineHeight: resolveLineHeight(computed ? computed.lineHeight : null, fontSize),
      style: parts.join(';')
    }
  }

  private _computed(element: Element): CSSStyleDeclaration | null {
    try {
      const computed = window.getComputedStyle(element as any)
      return computed && computed.fontSize ? computed : null
    } catch (error) {
      return null
    }
  }

  /** parseFloat tolerante: "normal" y "" caen al valor por defecto. */
  private _number(raw: string | null, fallback: number): number {
    if (!raw) return fallback
    const value = parseFloat(raw)
    return isFinite(value) ? value : fallback
  }

  private _scaled(font: FontSpec, scale: number): FontSpec {
    if (scale === 1) return font
    return {
      fontFamily: font.fontFamily,
      fontSize: font.fontSize * scale,
      fontStyle: font.fontStyle,
      fontWeight: font.fontWeight,
      fontVariant: font.fontVariant,
      letterSpacing: font.letterSpacing * scale,
      wordSpacing: font.wordSpacing * scale
    }
  }

  // -------------------------------------------------------------- composicion

  private _composeAll(
    area: TextArea,
    styles: RunStyle[][],
    scale: number,
    wraps: boolean
  ): Line[] {
    const lines: Line[] = []

    for (let p = 0; p < area.paragraphs.length; p++) {
      const paragraphLines = this._composeParagraph(
        area.paragraphs[p],
        styles[p],
        wraps ? area.width : Infinity,
        scale
      )
      for (let i = 0; i < paragraphLines.length; i++) lines.push(paragraphLines[i])
    }

    return lines
  }

  private _composeParagraph(
    paragraph: Paragraph,
    styles: RunStyle[],
    maxWidth: number,
    scale: number
  ): Line[] {
    const tokens = this._tokenize(paragraph, maxWidth !== Infinity)
    const lines: Line[] = []

    let current: Token[] = []
    let width = 0

    const widthOf = (token: Token): number => {
      const style = styles[token.run]
      if (!style) return 0
      return this._measurer.measure(token.text, this._scaled(style.font, scale))
    }

    const heightOf = (tokensInLine: Token[]): number => {
      let height = 0
      for (let i = 0; i < tokensInLine.length; i++) {
        const style = styles[tokensInLine[i].run]
        if (style && style.lineHeight * scale > height) height = style.lineHeight * scale
      }
      if (height === 0 && styles.length > 0) height = styles[0].lineHeight * scale
      return height
    }

    const flush = (lastOfParagraph: boolean) => {
      const trimmed = this._trimSpaces(current)
      let trimmedWidth = 0
      for (let i = 0; i < trimmed.length; i++) trimmedWidth += widthOf(trimmed[i])

      lines.push({
        tokens: trimmed,
        width: trimmedWidth,
        height: heightOf(current.length > 0 ? current : trimmed),
        lastOfParagraph: lastOfParagraph
      })

      current = []
      width = 0
    }

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const tokenWidth = widthOf(token)

      // Un espacio al principio de linea no cuenta: es el que sobro del corte anterior.
      if (token.isSpace && current.length === 0) continue

      if (!token.isSpace && width + tokenWidth > maxWidth && current.length > 0) {
        flush(false)
      }

      // Palabra sola mas ancha que el marco: se parte por caracteres para no desbordar.
      if (!token.isSpace && tokenWidth > maxWidth && current.length === 0) {
        const pieces = this._hardBreak(token, styles, maxWidth, scale)
        for (let k = 0; k < pieces.length; k++) {
          if (k > 0) flush(false)
          current.push(pieces[k])
          width += widthOf(pieces[k])
        }
        continue
      }

      current.push(token)
      width += tokenWidth
    }

    flush(true)

    // Un parrafo vacio sigue ocupando una linea: es un salto en blanco deliberado.
    if (lines.length === 0) {
      lines.push({ tokens: [], width: 0, height: heightOf([]), lastOfParagraph: true })
    }

    return lines
  }

  /**
   * Palabras y espacios por separado, para poder soltar el espacio justo en el corte.
   * En un marco los espacios interiores se normalizan a uno solo: si no, el reparto del
   * justificado contaria dos veces el mismo hueco.
   */
  private _tokenize(paragraph: Paragraph, collapseSpaces: boolean): Token[] {
    const tokens: Token[] = []

    for (let r = 0; r < paragraph.runs.length; r++) {
      const pieces = paragraph.runs[r].text.split(/(\s+)/)

      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i]
        if (!piece) continue

        const isSpace = /^\s+$/.test(piece)
        tokens.push({
          text: isSpace && collapseSpaces ? ' ' : piece,
          isSpace: isSpace,
          run: r
        })
      }
    }

    return tokens
  }

  private _hardBreak(
    token: Token,
    styles: RunStyle[],
    maxWidth: number,
    scale: number
  ): Token[] {
    const style = styles[token.run]
    if (!style) return [token]

    const font = this._scaled(style.font, scale)
    const pieces: Token[] = []

    let buffer = ''
    for (let i = 0; i < token.text.length; i++) {
      const next = buffer + token.text.charAt(i)
      if (buffer && this._measurer.measure(next, font) > maxWidth) {
        pieces.push({ text: buffer, isSpace: false, run: token.run })
        buffer = token.text.charAt(i)
      } else {
        buffer = next
      }
    }
    if (buffer) pieces.push({ text: buffer, isSpace: false, run: token.run })

    return pieces.length > 0 ? pieces : [token]
  }

  private _trimSpaces(tokens: Token[]): Token[] {
    let start = 0
    let end = tokens.length
    while (start < end && tokens[start].isSpace) start++
    while (end > start && tokens[end - 1].isSpace) end--
    return tokens.slice(start, end)
  }

  // --------------------------------------------------------- reducir hasta que entre

  /**
   * Mayor escala del cuerpo con la que el texto entra en el alto del marco.
   * Busqueda binaria: menos cuerpo son lineas mas cortas y menos altas, asi que la
   * altura total baja de forma monotona con la escala.
   */
  private _fitScale(area: TextArea, styles: RunStyle[][]): number {
    if (area.height === null || area.height <= 0) return 1

    const heightAt = (scale: number): number => {
      const lines = this._composeAll(area, styles, scale, true)
      let total = 0
      for (let i = 0; i < lines.length; i++) total += lines[i].height
      return total
    }

    if (heightAt(1) <= area.height) return 1

    let low = this._minScale
    let high = 1
    for (let i = 0; i < 12; i++) {
      const mid = (low + high) / 2
      if (heightAt(mid) <= area.height) low = mid
      else high = mid
    }

    return low
  }

  // ------------------------------------------------------------------ emision

  private _render(
    area: TextArea,
    styles: RunStyle[][],
    lines: Line[],
    scale: number,
    wraps: boolean
  ): SVGTextElement {
    const text = document.createElementNS(SVG_NS, 'text') as SVGTextElement

    this._copyAttributes(area.element, text)
    text.setAttributeNS(XML_NS, 'xml:space', 'preserve')
    text.setAttribute('style', this._rootStyle(area, styles, scale, wraps))

    const anchorX = this._anchorX(area, wraps)
    let baseline = this._firstBaseline(area, styles, scale)
    let shift = 0
    let paragraphIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (wraps) {
        if (i > 0) baseline += line.height
      } else {
        // Texto plano: cada linea original conserva su y, y las lineas nuevas que
        // aparecieron al sustituir empujan hacia abajo las que venian despues.
        const paragraph = area.paragraphs[paragraphIndex]
        if (i === 0) {
          baseline = (paragraph && paragraph.anchorY !== null ? paragraph.anchorY : baseline)
        } else if (paragraph && paragraph.anchorY !== null) {
          baseline = paragraph.anchorY + shift
        } else {
          baseline += line.height
          shift += line.height
        }
      }

      const x = wraps
        ? anchorX
        : this._plainX(area.paragraphs[paragraphIndex], anchorX)

      text.appendChild(this._renderLine(line, styles[paragraphIndex] || [], area, x, baseline, scale, wraps))

      if (line.lastOfParagraph) paragraphIndex++
    }

    return text
  }

  private _renderLine(
    line: Line,
    styles: RunStyle[],
    area: TextArea,
    x: number,
    y: number,
    scale: number,
    wraps: boolean
  ): SVGTSpanElement {
    const tspan = document.createElementNS(SVG_NS, 'tspan') as SVGTSpanElement
    tspan.setAttribute('x', this._round(x))
    tspan.setAttribute('y', this._round(y))

    if (wraps && area.align === 'justify' && !line.lastOfParagraph) {
      const spacing = this._justifySpacing(line, area.width)
      if (spacing > 0) tspan.setAttribute('style', 'word-spacing:' + this._round(spacing) + 'px')
    }

    // Una linea vacia igual necesita contenido o algunos motores la colapsan.
    if (line.tokens.length === 0) {
      tspan.appendChild(document.createTextNode(' '))
      return tspan
    }

    const groups = this._groupByRun(line.tokens)
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      const style = styles[group.run]
      const declarations: string[] = []

      if (style && style.style) declarations.push(style.style)
      if (style && scale !== 1) {
        declarations.push('font-size:' + this._round(style.font.fontSize * scale) + 'px')
      }

      if (declarations.length === 0) {
        tspan.appendChild(document.createTextNode(group.text))
        continue
      }

      const runSpan = document.createElementNS(SVG_NS, 'tspan') as SVGTSpanElement
      runSpan.setAttribute('style', declarations.join(';'))
      runSpan.textContent = group.text
      tspan.appendChild(runSpan)
    }

    return tspan
  }

  private _groupByRun(tokens: Token[]): { run: number; text: string }[] {
    const groups: { run: number; text: string }[] = []

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const last = groups.length > 0 ? groups[groups.length - 1] : null
      if (last && last.run === token.run) last.text += token.text
      else groups.push({ run: token.run, text: token.text })
    }

    return groups
  }

  /** Sobrante de la linea repartido entre sus espacios interiores. */
  private _justifySpacing(line: Line, width: number): number {
    let spaces = 0
    for (let i = 0; i < line.tokens.length; i++) {
      if (line.tokens[i].isSpace) spaces++
    }
    if (spaces === 0) return 0

    const extra = width - line.width
    return extra > 0 ? extra / spaces : 0
  }

  private _anchorX(area: TextArea, wraps: boolean): number {
    if (!wraps) return area.left
    if (area.align === 'center') return area.left + area.width / 2
    if (area.align === 'end') return area.left + area.width
    return area.left
  }

  private _plainX(paragraph: Paragraph | undefined, fallback: number): number {
    if (paragraph && paragraph.anchorX !== null) return paragraph.anchorX
    return fallback
  }

  /**
   * Con inline-size y con texto plano la primera linea base esta donde diga y.
   * Con un marco hay que bajarla desde el borde superior: media interlinea de sobrante
   * mas el ascendente, que es como coloca Inkscape.
   */
  private _firstBaseline(area: TextArea, styles: RunStyle[][], scale: number): number {
    if (area.firstBaseline !== null) return area.firstBaseline

    const style = styles.length > 0 && styles[0].length > 0 ? styles[0][0] : null
    if (!style) return area.top

    const font = this._scaled(style.font, scale)
    const lineHeight = style.lineHeight * scale
    const fraction = this._measurer.ascentFraction(font)

    return area.top + font.fontSize * fraction + (lineHeight - font.fontSize) / 2
  }

  private _rootStyle(
    area: TextArea,
    styles: RunStyle[][],
    scale: number,
    wraps: boolean
  ): string {
    const declarations: string[] = []
    const original = area.element.getAttribute('style') || ''
    const pieces = original.split(';')

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]
      const colon = piece.indexOf(':')
      if (colon <= 0) continue

      const name = piece.slice(0, colon).trim().toLowerCase()
      if (DROPPED_PROPERTIES.indexOf(name) !== -1) continue
      if (name === 'font-size' && scale !== 1) continue
      if (name === 'text-anchor' && wraps) continue
      declarations.push(piece.trim())
    }

    if (scale !== 1 && styles.length > 0 && styles[0].length > 0) {
      declarations.push('font-size:' + this._round(styles[0][0].font.fontSize * scale) + 'px')
    }

    if (wraps) {
      declarations.push('text-anchor:' + this._textAnchor(area.align))
    }

    // Se emiten las lineas ya cortadas: si el motor las volviera a plegar por su cuenta
    // el resultado seria doble wrap.
    declarations.push('white-space:pre')

    return declarations.join(';')
  }

  private _textAnchor(align: TextAlign): string {
    if (align === 'center') return 'middle'
    if (align === 'end') return 'end'
    return 'start'
  }

  private _copyAttributes(source: Element, target: Element): void {
    const attributes = source.attributes

    for (let i = 0; i < attributes.length; i++) {
      const attribute = attributes[i]
      if (DROPPED_ATTRIBUTES.indexOf(attribute.name) !== -1) continue
      try {
        if (attribute.namespaceURI) {
          target.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value)
        } else {
          target.setAttribute(attribute.name, attribute.value)
        }
      } catch (error) {
        // Un atributo con prefijo desconocido no vale la pena: se ignora.
      }
    }
  }

  private _round(value: number): string {
    return String(Math.round(value * 1000) / 1000)
  }
}
