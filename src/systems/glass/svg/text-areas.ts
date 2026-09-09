// Deteccion de areas de texto y extraccion de parrafos.
//
// Un "area de texto" es un texto con marco: el contenido tiene que repartirse en varias
// lineas dentro de un rectangulo. Hay tres formas de escribirlo y hay que soportar las
// tres porque conviven en las plantillas reales:
//
//   1. <flowRoot> + <flowRegion><rect> + <flowPara>   SVG 1.2, Inkscape 0.92 y anteriores.
//      Se saco del estandar; ningun navegador lo dibuja. Inkscape lo conserva tal cual
//      al guardar, sin fallback, asi que hoy este texto directamente no se ve.
//
//   2. <text style="shape-inside:url(#rect)">          SVG 2, Inkscape 1.x. Es el default
//      actual. Ningun navegador implementa shape-inside, pero Inkscape hornea su propio
//      wrap en <tspan x y> al guardar, asi que algo se ve: las lineas que calculo
//      Inkscape ANTES de sustituir las variables. Con un %NOMBRE% largo se desborda.
//
//   3. <text style="inline-size:N">                    SVG 2, ancho fijo sin rectangulo.
//      Mismo caso que el anterior.
//
// En 2 y 3 los <tspan> horneados son resultado de wrap, no saltos del autor: hay que
// concatenarlos y volver a partir. El salto duro si se distingue, porque Inkscape lo
// deja como un \n literal dentro del tspan.

import {
  tagName,
  ownProperty,
  parseLength,
  parseUrlReference,
  numericAttribute
} from './style-utils'

export type TextAreaKind = 'flow-root' | 'shape-inside' | 'inline-size' | 'plain'

export type TextAlign = 'start' | 'center' | 'end' | 'justify'

export interface TextRun {
  text: string
  /** Cadena de elementos entre el area y el nodo de texto, de fuera hacia dentro. */
  styleChain: Element[]
}

export interface Paragraph {
  runs: TextRun[]
  /** Solo en texto plano: posicion original de la linea, para no mover lo que ya estaba. */
  anchorX: number | null
  anchorY: number | null
}

export interface TextArea {
  element: Element
  kind: TextAreaKind
  align: TextAlign
  /** Borde izquierdo, superior, ancho y alto utiles en unidades de usuario. */
  left: number
  top: number
  width: number
  height: number | null
  /** Si viene, la primera linea base va exactamente aca en vez de calcularse desde top. */
  firstBaseline: number | null
  paragraphs: Paragraph[]
}

type BreakMode = 'flow' | 'inline' | 'lines'

const STYLE_ATTRIBUTES = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'opacity',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
  'font-stretch', 'letter-spacing', 'word-spacing', 'text-decoration', 'baseline-shift'
]

export class TextAreaFinder {
  /**
   * Recorre el SVG y devuelve todas las areas de texto, incluidos los <text> planos.
   * El llamador decide que hacer con los planos: normalmente solo se reconstruyen si
   * despues de sustituir variables aparecio un salto de linea.
   */
  static find(root: Element): TextArea[] {
    const areas: TextArea[] = []
    const elements = this._allElements(root)

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      const name = tagName(element)

      if (name === 'flowroot') {
        const area = this._buildFlowRoot(element)
        if (area) areas.push(area)
        continue
      }

      if (name !== 'text') continue

      // Un texto sobre trazado tiene su propia geometria: no se toca.
      if (this._hasDescendant(element, 'textpath')) continue
      // Los <text> dentro de un <flowRoot> ya los cubre el area de flujo.
      if (this._hasAncestor(element, 'flowroot', root)) continue

      const area = this._buildText(root, element)
      if (area) areas.push(area)
    }

    return areas
  }

  /** Atributos de estilo utiles de un elemento, como texto listo para un tspan. */
  static styleOf(element: Element): string {
    const parts: string[] = []

    const inline = element.getAttribute('style')
    if (inline) parts.push(inline.trim().replace(/;+$/, ''))

    for (let i = 0; i < STYLE_ATTRIBUTES.length; i++) {
      const name = STYLE_ATTRIBUTES[i]
      const value = element.getAttribute(name)
      if (value) parts.push(name + ':' + value.trim())
    }

    return parts.join(';')
  }

  // ---------------------------------------------------------------- flowRoot

  private static _buildFlowRoot(element: Element): TextArea | null {
    const region = this._firstChildNamed(element, 'flowregion')
    const shape = region ? this._firstChildNamed(region, 'rect') : null
    const box = shape ? this._rectBox(shape) : null
    if (!box) return null

    const paragraphs = this._extractParagraphs(element, 'flow', this._preserves(element))
    if (paragraphs.length === 0) return null

    return {
      element: element,
      kind: 'flow-root',
      align: this._align(element),
      left: box.x,
      top: box.y,
      width: box.width,
      height: box.height,
      firstBaseline: null,
      paragraphs: paragraphs
    }
  }

  // -------------------------------------------------------------------- text

  private static _buildText(root: Element, element: Element): TextArea | null {
    const fontSize = this._fontSize(element)
    const align = this._align(element)
    const preserve = this._preserves(element)

    const shapeId = parseUrlReference(ownProperty(element, 'shape-inside'))
    if (shapeId) {
      const shape = this._findById(root, shapeId)
      const box = shape ? this._shapeBox(shape) : null
      if (box) {
        const padding = parseLength(ownProperty(element, 'shape-padding'), fontSize, box.width) || 0
        const paragraphs = this._extractParagraphs(element, 'inline', preserve)
        if (paragraphs.length === 0) return null

        return {
          element: element,
          kind: 'shape-inside',
          align: align,
          left: box.x + padding,
          top: box.y + padding,
          width: Math.max(0, box.width - padding * 2),
          height: Math.max(0, box.height - padding * 2),
          firstBaseline: null,
          paragraphs: paragraphs
        }
      }
    }

    const inlineSize = parseLength(ownProperty(element, 'inline-size'), fontSize, 0)
    if (inlineSize !== null && inlineSize > 0) {
      const anchorX = numericAttribute(element, 'x', 0)
      const anchorY = numericAttribute(element, 'y', 0)
      const paragraphs = this._extractParagraphs(element, 'inline', preserve)
      if (paragraphs.length === 0) return null

      return {
        element: element,
        kind: 'inline-size',
        align: align,
        left: this._inlineSizeLeft(anchorX, inlineSize, align),
        top: anchorY,
        width: inlineSize,
        // inline-size no acota el alto: el texto crece hacia abajo sin limite.
        height: null,
        firstBaseline: anchorY,
        paragraphs: paragraphs
      }
    }

    const paragraphs = this._extractParagraphs(element, 'lines', preserve)
    if (paragraphs.length === 0) return null

    return {
      element: element,
      kind: 'plain',
      align: align,
      left: numericAttribute(element, 'x', 0),
      top: numericAttribute(element, 'y', 0),
      width: 0,
      height: null,
      firstBaseline: numericAttribute(element, 'y', 0),
      paragraphs: paragraphs
    }
  }

  /** Con inline-size el ancla marca el punto de anclaje, no el borde de la caja. */
  private static _inlineSizeLeft(anchorX: number, width: number, align: TextAlign): number {
    if (align === 'center') return anchorX - width / 2
    if (align === 'end') return anchorX - width
    return anchorX
  }

  // -------------------------------------------------------------- parrafos

  private static _extractParagraphs(
    container: Element,
    mode: BreakMode,
    preserve: boolean
  ): Paragraph[] {
    const paragraphs: Paragraph[] = []
    let current: Paragraph | null = null

    const startParagraph = (source: Element | null): Paragraph => {
      const paragraph: Paragraph = {
        runs: [],
        anchorX: source && source.hasAttribute('x') ? numericAttribute(source, 'x', 0) : null,
        anchorY: source && source.hasAttribute('y') ? numericAttribute(source, 'y', 0) : null
      }
      paragraphs.push(paragraph)
      current = paragraph
      return paragraph
    }

    const pushText = (text: string, chain: Element[]) => {
      if (!text) return
      const target = current || startParagraph(null)
      target.runs.push({ text: text, styleChain: chain.slice() })
    }

    const walk = (node: Element, chain: Element[]) => {
      const children = node.childNodes

      for (let i = 0; i < children.length; i++) {
        const child = children[i]

        if (child.nodeType === 3) {
          // El texto suelto dentro de un flowRoot no se dibuja: en SVG 1.2 solo cuentan
          // los flowPara. Suele ser la indentacion del archivo.
          if (mode === 'flow' && node === container) continue
          if (this._isIndentation(child as Text, node, preserve)) continue

          const raw = (child as Text).data
          const normalized = preserve ? raw : raw.replace(/[\t\n\r ]+/g, ' ')

          if (!preserve) {
            pushText(normalized, chain)
            continue
          }

          // Con espacios preservados el \n es un salto de parrafo real.
          const pieces = normalized.split(/\r\n|\r|\n/)
          for (let p = 0; p < pieces.length; p++) {
            if (p > 0) startParagraph(null)
            pushText(pieces[p], chain)
          }
          continue
        }

        if (child.nodeType !== 1) continue

        const element = child as Element
        const name = tagName(element)

        if (name === 'flowregion' || name === 'flowregionexclude') continue

        if (mode === 'flow' && (name === 'flowpara' || name === 'flowdiv')) {
          startParagraph(element)
          walk(element, chain.concat([element]))
          continue
        }

        if (name === 'flowline' || name === 'br') {
          startParagraph(element)
          continue
        }

        if (mode === 'lines' && name === 'tspan' && this._isLineTspan(element)) {
          startParagraph(element)
          walk(element, chain.concat([element]))
          continue
        }

        // Cualquier otro elemento es un tramo con estilo propio dentro del parrafo.
        walk(element, chain.concat([element]))
      }
    }

    walk(container, [])

    // Un parrafo sin texto al final solo estorba; en medio es una linea en blanco real.
    while (paragraphs.length > 0 && this._isEmpty(paragraphs[paragraphs.length - 1])) {
      paragraphs.pop()
    }
    while (paragraphs.length > 0 && this._isEmpty(paragraphs[0]) && paragraphs[0].anchorY === null) {
      paragraphs.shift()
    }

    return paragraphs
  }

  /**
   * En Inkscape cada linea escrita a mano es un tspan con sodipodi:role="line".
   * Los SVG generados por IA suelen usar tspan con x e y explicitos para lo mismo.
   */
  private static _isLineTspan(element: Element): boolean {
    const role = element.getAttribute('sodipodi:role') || element.getAttribute('role')
    if (role === 'line') return true
    return element.hasAttribute('x') && element.hasAttribute('y')
  }

  /**
   * Nodo de texto que solo contiene la indentacion del archivo entre dos elementos.
   * Se descarta para que un SVG con sangria no genere parrafos vacios.
   */
  private static _isIndentation(node: Text, parent: Element, preserve: boolean): boolean {
    if (!preserve) return false
    if (/\S/.test(node.data)) return false
    if (node.data.indexOf('\n') === -1) return false
    return parent.getElementsByTagName('*').length > 0
  }

  private static _isEmpty(paragraph: Paragraph): boolean {
    for (let i = 0; i < paragraph.runs.length; i++) {
      if (paragraph.runs[i].text.length > 0) return false
    }
    return true
  }

  // ------------------------------------------------------------------ estilo

  private static _align(element: Element): TextAlign {
    const computed = this._computed(element)
    const textAlign = (computed ? computed.textAlign : ownProperty(element, 'text-align')) || ''
    const normalized = textAlign.trim().toLowerCase()

    if (normalized === 'justify') return 'justify'
    if (normalized === 'center' || normalized === 'middle') return 'center'
    if (normalized === 'right' || normalized === 'end') return 'end'

    // text-align "start" tanto puede ser una eleccion como el valor por defecto, asi
    // que cuando no dice nada manda text-anchor, que es lo que usa el SVG plano.
    const anchor = (computed ? computed.textAnchor : ownProperty(element, 'text-anchor')) || ''
    const anchorValue = anchor.trim().toLowerCase()
    if (anchorValue === 'middle') return 'center'
    if (anchorValue === 'end') return 'end'

    return 'start'
  }

  private static _preserves(element: Element): boolean {
    const computed = this._computed(element)
    const whiteSpace = computed ? computed.whiteSpace : ownProperty(element, 'white-space')
    if (whiteSpace && /^pre/.test(whiteSpace.trim().toLowerCase())) return true

    let current: Element | null = element
    while (current && current.nodeType === 1) {
      const space = current.getAttribute('xml:space') || current.getAttribute('space')
      if (space === 'preserve') return true
      if (space === 'default') return false
      if (tagName(current) === 'svg') break
      current = current.parentElement
    }
    return false
  }

  private static _fontSize(element: Element): number {
    const computed = this._computed(element)
    if (computed) {
      const size = parseFloat(computed.fontSize)
      if (isFinite(size) && size > 0) return size
    }

    let current: Element | null = element
    while (current && current.nodeType === 1) {
      const raw = ownProperty(current, 'font-size')
      const parsed = parseLength(raw, 16, 16)
      if (parsed !== null && parsed > 0) return parsed
      if (tagName(current) === 'svg') break
      current = current.parentElement
    }
    return 16
  }

  private static _computed(element: Element): CSSStyleDeclaration | null {
    try {
      const computed = window.getComputedStyle(element as any)
      return computed && computed.fontSize ? computed : null
    } catch (error) {
      return null
    }
  }

  // --------------------------------------------------------------- geometria

  private static _shapeBox(
    shape: Element
  ): { x: number; y: number; width: number; height: number } | null {
    if (tagName(shape) === 'rect') return this._rectBox(shape)

    // Para cualquier otra forma se aproxima por su caja envolvente. Puede fallar si el
    // elemento vive en <defs> y el navegador no le da geometria.
    try {
      const bbox = (shape as SVGGraphicsElement).getBBox()
      if (bbox && bbox.width > 0 && bbox.height > 0) {
        return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
      }
    } catch (error) {
      console.warn('[svg-text] no se pudo medir la forma de shape-inside:', error)
    }
    return null
  }

  private static _rectBox(
    rect: Element
  ): { x: number; y: number; width: number; height: number } | null {
    const width = numericAttribute(rect, 'width', 0)
    const height = numericAttribute(rect, 'height', 0)
    if (width <= 0 || height <= 0) return null

    return {
      x: numericAttribute(rect, 'x', 0),
      y: numericAttribute(rect, 'y', 0),
      width: width,
      height: height
    }
  }

  // ----------------------------------------------------------------- helpers

  private static _allElements(root: Element): Element[] {
    const all: Element[] = [root]
    const descendants = root.getElementsByTagName('*')
    for (let i = 0; i < descendants.length; i++) all.push(descendants[i])
    return all
  }

  private static _firstChildNamed(parent: Element, name: string): Element | null {
    const children = parent.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType === 1 && tagName(child) === name) return child as Element
    }
    return null
  }

  private static _hasDescendant(element: Element, name: string): boolean {
    const descendants = element.getElementsByTagName('*')
    for (let i = 0; i < descendants.length; i++) {
      if (tagName(descendants[i]) === name) return true
    }
    return false
  }

  private static _hasAncestor(element: Element, name: string, root: Element): boolean {
    let current: Element | null = element.parentElement
    while (current && current !== root) {
      if (tagName(current) === name) return true
      current = current.parentElement
    }
    return false
  }

  /**
   * Busca por id dentro del SVG. No se usa document.getElementById porque el SVG vive
   * inyectado en la pagina y los ids podrian chocar con los del resto del documento.
   */
  private static _findById(root: Element, id: string): Element | null {
    if (root.getAttribute('id') === id) return root
    const descendants = root.getElementsByTagName('*')
    for (let i = 0; i < descendants.length; i++) {
      if (descendants[i].getAttribute('id') === id) return descendants[i]
    }
    return null
  }
}
