// Sustitucion de los %VAR% dentro de un SVG ya parseado.
//
// Hasta ahora esto se hacia con un replace sobre la cadena del archivo. Eso falla con
// las plantillas reales de Inkscape: en cuanto se edita a mitad de palabra, o se mete
// un salto de linea, Inkscape parte el contenido en varios <tspan>, y un %NOMBRE%
// queda como "%NOM" en uno y "BRE%" en el otro. Ninguno de los dos coincide con el
// patron, la variable no se sustituye y el arte sale con el marcador crudo a la vista.
//
// La solucion es trabajar sobre el DOM: se concatena el texto de todos los nodos de un
// mismo contenedor, se sustituye sobre esa cadena completa, y se reparte el resultado
// de vuelta respetando a que nodo pertenecia cada tramo intacto.

import { tagName } from './style-utils'

export interface SvgParam {
  label: string
  value: string
}

interface Replacement {
  start: number
  end: number
  text: string
}

export class SvgVariables {
  /**
   * Sustituye en texto y en atributos. Las variables sin valor conocido se dejan tal
   * cual, para que una plantilla mal configurada se note en pantalla en vez de
   * desaparecer en silencio.
   *
   * @param root elemento raiz del SVG
   * @param params lista de { label, value } tal como la manda la API
   * @param skipLabels etiquetas que gestiona otro proceso, como %NEWS%
   * @returns cantidad de sustituciones aplicadas
   */
  static substitute(root: Element, params: SvgParam[], skipLabels?: string[]): number {
    const lookup = this._buildLookup(params, skipLabels)
    const labels = Object.keys(lookup)
    if (labels.length === 0) return 0

    const pattern = this._buildPattern(labels)
    let count = 0

    count += this._substituteInAttributes(root, pattern, lookup)
    count += this._substituteInText(root, pattern, lookup)

    return count
  }

  /** Todos los %VAR% presentes en el SVG, hayan sido sustituidos o no. */
  static collectLabels(root: Element): string[] {
    const found: Record<string, true> = {}
    const generic = /%[^%\s<>]+%/g

    const scan = (value: string | null) => {
      if (!value || value.indexOf('%') === -1) return
      generic.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = generic.exec(value)) !== null) {
        found[match[0]] = true
      }
    }

    const elements = this._allElements(root)
    for (let i = 0; i < elements.length; i++) {
      const attributes = elements[i].attributes
      for (let a = 0; a < attributes.length; a++) {
        scan(attributes[a].value)
      }
    }

    const containers = this._textContainers(root)
    for (let i = 0; i < containers.length; i++) {
      scan(this._collectTextNodes(containers[i]).map(node => node.data).join(''))
    }

    return Object.keys(found)
  }

  private static _buildLookup(
    params: SvgParam[],
    skipLabels?: string[]
  ): Record<string, string> {
    const skip: Record<string, true> = {}
    if (skipLabels) {
      for (let i = 0; i < skipLabels.length; i++) skip[skipLabels[i]] = true
    }

    const lookup: Record<string, string> = {}
    if (!params) return lookup

    for (let i = 0; i < params.length; i++) {
      const param = params[i]
      if (!param || !param.label) continue
      if (skip[param.label]) continue
      lookup[param.label] = param.value === undefined || param.value === null
        ? ''
        : String(param.value)
    }
    return lookup
  }

  /**
   * Un solo patron con todas las etiquetas, de la mas larga a la mas corta para que
   * %TITULO_2% gane sobre %TITULO% cuando ambas existen.
   */
  private static _buildPattern(labels: string[]): RegExp {
    const sorted = labels.slice().sort((a, b) => b.length - a.length)
    const escaped = sorted.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return new RegExp('(?:' + escaped.join('|') + ')', 'g')
  }

  private static _substituteInAttributes(
    root: Element,
    pattern: RegExp,
    lookup: Record<string, string>
  ): number {
    let count = 0
    const elements = this._allElements(root)

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      const attributes = element.attributes

      for (let a = 0; a < attributes.length; a++) {
        const attribute = attributes[a]
        const value = attribute.value
        if (!value || value.indexOf('%') === -1) continue

        pattern.lastIndex = 0
        const replaced = value.replace(pattern, match => {
          const resolved = lookup[match]
          if (resolved === undefined) return match
          count++
          return resolved
        })

        if (replaced !== value) attribute.value = replaced
      }
    }

    return count
  }

  private static _substituteInText(
    root: Element,
    pattern: RegExp,
    lookup: Record<string, string>
  ): number {
    let count = 0
    const containers = this._textContainers(root)

    for (let i = 0; i < containers.length; i++) {
      const nodes = this._collectTextNodes(containers[i])
      if (nodes.length === 0) continue
      count += this._substituteAcrossNodes(nodes, pattern, lookup)
    }

    return count
  }

  /**
   * El nucleo: sustituye sobre la concatenacion de varios nodos de texto y devuelve
   * cada tramo a su nodo original. El texto de una variable partida se deposita
   * completo en el nodo donde empezaba la variable, y los nodos que aportaban el
   * resto quedan sin esa parte.
   */
  private static _substituteAcrossNodes(
    nodes: Text[],
    pattern: RegExp,
    lookup: Record<string, string>
  ): number {
    const full = nodes.map(node => node.data).join('')
    if (full.indexOf('%') === -1) return 0

    const replacements: Replacement[] = []
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(full)) !== null) {
      const resolved = lookup[match[0]]
      if (resolved !== undefined) {
        replacements.push({ start: match.index, end: match.index + match[0].length, text: resolved })
      }
      if (match[0].length === 0) pattern.lastIndex++
    }
    if (replacements.length === 0) return 0

    const starts: number[] = []
    let offset = 0
    for (let i = 0; i < nodes.length; i++) {
      starts.push(offset)
      offset += nodes[i].data.length
    }

    const out: string[] = []
    for (let i = 0; i < nodes.length; i++) out.push('')

    const copyRange = (from: number, to: number) => {
      if (to <= from) return
      for (let i = 0; i < nodes.length; i++) {
        const nodeStart = starts[i]
        const nodeEnd = nodeStart + nodes[i].data.length
        const a = Math.max(from, nodeStart)
        const b = Math.min(to, nodeEnd)
        if (b > a) out[i] += full.slice(a, b)
      }
    }

    const nodeIndexAt = (position: number): number => {
      let index = 0
      for (let i = 0; i < starts.length; i++) {
        if (starts[i] <= position) index = i
        else break
      }
      return index
    }

    let cursor = 0
    for (let i = 0; i < replacements.length; i++) {
      const replacement = replacements[i]
      copyRange(cursor, replacement.start)
      out[nodeIndexAt(replacement.start)] += replacement.text
      cursor = replacement.end
    }
    copyRange(cursor, full.length)

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].data !== out[i]) nodes[i].data = out[i]
    }

    return replacements.length
  }

  /** <text> y <flowRoot>, que son los unicos donde el texto se ve. */
  private static _textContainers(root: Element): Element[] {
    const containers: Element[] = []
    const elements = this._allElements(root)

    for (let i = 0; i < elements.length; i++) {
      const name = tagName(elements[i])
      if (name === 'text' || name === 'flowroot') containers.push(elements[i])
    }

    return containers
  }

  private static _allElements(root: Element): Element[] {
    const all: Element[] = [root]
    const descendants = root.getElementsByTagName('*')
    for (let i = 0; i < descendants.length; i++) all.push(descendants[i])
    return all
  }

  private static _collectTextNodes(container: Element): Text[] {
    const nodes: Text[] = []

    const walk = (node: Node) => {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i]
        if (child.nodeType === 3) nodes.push(child as Text)
        else if (child.nodeType === 1) walk(child)
      }
    }

    walk(container)
    return nodes
  }
}
