// Marquesina de noticias en SVG puro.
//
// Si, se puede hacer con un SVG simple, y sale mejor que como estaba. Lo que faltaba no
// era potencia del formato sino saber el ancho del texto: el codigo anterior lo pedia con
// getBBox() tras un setTimeout de 50 ms, y si las fuentes no habian cargado todavia se
// quedaba con un ancho equivocado, o directamente con un 200 inventado. La duracion del
// recorrido sale de ese ancho, asi que el error se veia como texto que corre demasiado
// rapido o demasiado lento.
//
// Ahora el ancho lo da el mismo medidor que usa el wrap, ya con las fuentes cargadas, y
// se conoce antes de dibujar nada.
//
// Estructura que se emite, toda SVG estandar:
//
//   <g [transform del texto original]>        <- ocupa exactamente el lugar del <text>
//     <g clip-path="url(#...)">               <- la ventana por la que se asoma
//       <g class="pista">                     <- lo unico que se anima
//         <text/> <text/> <text/>             <- copias suficientes para que no haya hueco
//
// La animacion es CSS y no SMIL. SMIL sigue funcionando en Chromium, pero Google llego a
// anunciar su retiro y las animaciones CSS son el camino que si tiene futuro; ademas
// permiten pausar y consultar el estado desde la propia hoja de estilos.

import { SVG_NS } from './style-utils'
import { TextArea } from './text-areas'
import { TextLayout } from './text-layout'

export interface NewsRequest {
  /** Texto ya resuelto, sin el marcador. */
  text: string
  /** Unidades de usuario por segundo. */
  speed: number
  /** true: bucle continuo. false: una sola pasada y avisa al terminar. */
  loop: boolean
  /** Identificador del glass, para no repetir ids entre mensajes. */
  glassId: string
  /** Se llama al terminar la unica pasada cuando loop es false. */
  onFinish?: () => void
}

export interface NewsResult {
  applied: boolean
  /** Ancho del texto en unidades de usuario. */
  width: number
  /** Segundos que tarda una vuelta completa. */
  duration: number
  copies: number
}

/** Separacion entre el final de una copia y el principio de la siguiente, en ems. */
const GAP_EM = 4

/** Velocidad de reserva si el parametro viene vacio o en cero. */
const DEFAULT_SPEED = 50

export class NewsTicker {
  private _layout: TextLayout
  private _sequence = 0

  constructor(layout: TextLayout) {
    this._layout = layout
  }

  /**
   * Sustituye el area por la marquesina. El area ya trae la caja resuelta, asi que si el
   * disenador dibujo un marco en Inkscape ese marco es la ventana; si el texto es suelto,
   * la ventana es el ancho del lienzo.
   */
  apply(root: SVGSVGElement, area: TextArea, request: NewsRequest): NewsResult {
    const vacio: NewsResult = { applied: false, width: 0, duration: 0, copies: 0 }

    const parent = area.element.parentNode
    if (!parent) return vacio

    const composed = this._layout.composeSingleLine(area, '   ')
    if (!composed || composed.width <= 0) return vacio

    const frame = this._window(root, area, composed.baseline, composed.lineHeight, composed.ascent)
    if (frame.width <= 0) return vacio

    this._sequence++
    const suffix = String(request.glassId || '0') + '-' + this._sequence
    const clipId = 'gn-news-clip-' + suffix
    const trackId = 'gn-news-track-' + suffix
    const animName = 'gn-news-anim-' + suffix

    const speed = request.speed > 0 ? request.speed : DEFAULT_SPEED
    const gap = composed.lineHeight * GAP_EM
    const step = composed.width + gap

    // El transform propio del texto pasa al grupo exterior: asi todo lo de adentro,
    // incluida la ventana de recorte, queda en el mismo sistema de coordenadas en el
    // que estaban la x y la y originales.
    const transform = composed.text.getAttribute('transform')
    composed.text.removeAttribute('transform')
    composed.text.removeAttribute('id')

    // En una marquesina el texto siempre arranca por su borde izquierdo. Si el arte
    // traia text-anchor middle o end, centrado sobre la x original, el recorrido
    // empezaria corrido media linea.
    const estilo = composed.text.getAttribute('style') || ''
    composed.text.setAttribute('style', estilo.replace(/;?\s*text-anchor\s*:[^;]*/gi, '') + ';text-anchor:start')

    const outer = document.createElementNS(SVG_NS, 'g')
    if (transform) outer.setAttribute('transform', transform)
    const originalId = area.element.getAttribute('id')
    if (originalId) outer.setAttribute('id', originalId)

    const clipped = document.createElementNS(SVG_NS, 'g')
    clipped.setAttribute('clip-path', 'url(#' + clipId + ')')

    const track = document.createElementNS(SVG_NS, 'g')
    track.setAttribute('id', trackId)

    let copies: number
    let from: number
    let to: number
    let duration: number

    if (request.loop) {
      // Bucle continuo: se repite el texto hasta cubrir la ventana mas un paso, y se
      // desplaza exactamente un paso. Al terminar, la copia siguiente esta donde estaba
      // la anterior, asi que el empalme no se ve.
      copies = Math.ceil((frame.width + step) / step) + 1
      from = 0
      to = -step
      duration = step / speed
    } else {
      // Una sola pasada: entra por la derecha de la ventana y sale por la izquierda.
      copies = 1
      from = frame.width - (area.left - frame.x)
      to = -(composed.width + (area.left - frame.x))
      duration = (from - to) / speed
    }

    for (let i = 0; i < copies; i++) {
      const copy = composed.text.cloneNode(true) as SVGTextElement
      if (i > 0) copy.setAttribute('transform', 'translate(' + this._round(i * step) + ',0)')
      copy.setAttribute('aria-hidden', i > 0 ? 'true' : 'false')
      track.appendChild(copy)
    }

    clipped.appendChild(track)
    outer.appendChild(clipped)
    parent.replaceChild(outer, area.element)

    this._addClip(root, clipId, frame)
    this._addAnimation(root, animName, trackId, from, to, duration, request.loop)

    if (!request.loop && request.onFinish) {
      this._onEnd(track, request.onFinish)
    }

    return { applied: true, width: composed.width, duration: duration, copies: copies }
  }

  /**
   * La ventana por la que se ve pasar el texto. Si el area tiene marco, ese es. Si el
   * texto es suelto, se toma el ancho del lienzo y una franja de alto generoso alrededor
   * de la linea base, para no cortar acentos ni colas.
   */
  private _window(
    root: SVGSVGElement,
    area: TextArea,
    baseline: number,
    lineHeight: number,
    ascent: number
  ): { x: number; y: number; width: number; height: number } {
    if (area.kind !== 'plain' && area.width > 0) {
      return {
        x: area.left,
        y: area.top,
        width: area.width,
        height: area.height !== null && area.height > 0 ? area.height : lineHeight * 1.6
      }
    }

    const box = this._viewBox(root)
    const alto = Math.max(lineHeight, ascent * 1.35) * 1.4
    return {
      x: box.x,
      y: baseline - ascent - (alto - lineHeight) / 2,
      width: box.width,
      height: alto
    }
  }

  private _viewBox(root: SVGSVGElement): { x: number; y: number; width: number; height: number } {
    const raw = root.getAttribute('viewBox')
    if (raw) {
      const parts = raw.split(/[\s,]+/).map(parseFloat)
      if (parts.length === 4 && isFinite(parts[2]) && parts[2] > 0) {
        return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
      }
    }

    const width = parseFloat(root.getAttribute('width') || '0')
    const height = parseFloat(root.getAttribute('height') || '0')
    return { x: 0, y: 0, width: isFinite(width) ? width : 0, height: isFinite(height) ? height : 0 }
  }

  private _addClip(
    root: SVGSVGElement,
    id: string,
    frame: { x: number; y: number; width: number; height: number }
  ): void {
    const clip = document.createElementNS(SVG_NS, 'clipPath')
    clip.setAttribute('id', id)
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse')

    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('x', this._round(frame.x))
    rect.setAttribute('y', this._round(frame.y))
    rect.setAttribute('width', this._round(frame.width))
    rect.setAttribute('height', this._round(frame.height))

    clip.appendChild(rect)
    this._defs(root).appendChild(clip)
  }

  private _addAnimation(
    root: SVGSVGElement,
    name: string,
    trackId: string,
    from: number,
    to: number,
    duration: number,
    loop: boolean
  ): void {
    const style = document.createElementNS(SVG_NS, 'style')
    style.textContent =
      '@keyframes ' + name + '{' +
      'from{transform:translateX(' + this._round(from) + 'px)}' +
      'to{transform:translateX(' + this._round(to) + 'px)}}' +
      '#' + trackId + '{' +
      'animation:' + name + ' ' + this._round(duration) + 's linear ' +
      (loop ? 'infinite' : '1 forwards') + ';' +
      'will-change:transform}'

    this._defs(root).appendChild(style)
  }

  /** Avisa cuando termina la pasada unica, sin depender de los eventos de SMIL. */
  private _onEnd(track: SVGGElement, onFinish: () => void): void {
    let done = false
    const finish = function () {
      if (done) return
      done = true
      track.setAttribute('opacity', '0')
      onFinish()
    }

    track.addEventListener('animationend', finish)
  }

  private _defs(root: SVGSVGElement): Element {
    const children = root.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.nodeType === 1 && (child as Element).localName === 'defs') {
        return child as Element
      }
    }

    const defs = document.createElementNS(SVG_NS, 'defs')
    root.insertBefore(defs, root.firstChild)
    return defs
  }

  private _round(value: number): string {
    return String(Math.round(value * 1000) / 1000)
  }
}
