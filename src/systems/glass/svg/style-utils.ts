// Utilidades de estilo para el parser de SVG.
//
// Chromium resuelve bien font-*, line-height, text-align y text-anchor con
// getComputedStyle, incluso sobre elementos que no sabe dibujar como <flowRoot>,
// asi que para esas propiedades conviene usarlo: respeta la herencia, los bloques
// <style> embebidos y las unidades relativas.
//
// En cambio shape-inside, shape-padding e inline-size no las implementa ningun
// navegador sobre <text>, y getComputedStyle devuelve "auto" o nada. Esas hay que
// leerlas a mano del atributo style o del atributo de presentacion.

export const SVG_NS = 'http://www.w3.org/2000/svg'
export const XML_NS = 'http://www.w3.org/XML/1998/namespace'

/**
 * Nombre de etiqueta en minusculas.
 * El parser de HTML baja a minusculas los tags de SVG que no conoce
 * (flowRoot -> flowroot), DOMParser en cambio los respeta. Comparar siempre por aca.
 */
export function tagName(node: Node): string {
  const el = node as Element
  return ((el.localName || el.nodeName || '') as string).toLowerCase()
}

/** Parsea un atributo style a un mapa de propiedad -> valor. */
export function parseStyleAttribute(value: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!value) return out

  const declarations = value.split(';')
  for (let i = 0; i < declarations.length; i++) {
    const declaration = declarations[i]
    const colon = declaration.indexOf(':')
    if (colon <= 0) continue
    const name = declaration.slice(0, colon).trim().toLowerCase()
    const raw = declaration.slice(colon + 1).trim()
    if (name && raw) out[name] = raw
  }
  return out
}

/**
 * Lee una propiedad del propio elemento, sin herencia: primero el atributo style,
 * despues el atributo de presentacion. Para shape-inside / inline-size, que son las
 * que getComputedStyle no sirve.
 */
export function ownProperty(el: Element, name: string): string | null {
  const inline = parseStyleAttribute(el.getAttribute('style'))[name.toLowerCase()]
  if (inline) return inline

  const presentation = el.getAttribute(name)
  if (presentation) return presentation.trim()

  return null
}

/** Igual que ownProperty pero subiendo por los ancestros hasta el <svg>. */
export function inheritedProperty(el: Element | null, name: string): string | null {
  let current: Element | null = el
  while (current && current.nodeType === 1) {
    const value = ownProperty(current, name)
    if (value) return value
    if (tagName(current) === 'svg') break
    current = current.parentElement
  }
  return null
}

const ABSOLUTE_UNITS: Record<string, number> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6
}

/**
 * Convierte una longitud CSS a unidades de usuario del SVG.
 * En SVG las unidades absolutas se convierten siempre con la convencion de 96px por
 * pulgada, sin importar el viewBox, asi que la tabla de arriba vale tal cual.
 *
 * @param raw valor crudo, con o sin unidad
 * @param fontSize tamano de fuente en unidades de usuario, para em / ex / rem
 * @param percentBase referencia para los porcentajes
 */
export function parseLength(
  raw: string | null,
  fontSize: number,
  percentBase: number
): number | null {
  if (!raw) return null

  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-z%]*)$/.exec(raw.trim())
  if (!match) return null

  const amount = parseFloat(match[1])
  if (!isFinite(amount)) return null

  const unit = match[2].toLowerCase()
  if (!unit) return amount
  if (unit === '%') return (amount / 100) * percentBase
  if (unit === 'em' || unit === 'rem') return amount * fontSize
  if (unit === 'ex') return amount * fontSize * 0.5
  if (unit === 'ch') return amount * fontSize * 0.5

  const factor = ABSOLUTE_UNITS[unit]
  return factor === undefined ? null : amount * factor
}

/** Extrae el id de un url(#foo) / url("#foo"). Devuelve null si no es esa forma. */
export function parseUrlReference(raw: string | null): string | null {
  if (!raw) return null
  const match = /^url\(\s*(['"]?)#([^'")\s]+)\1\s*\)$/.exec(raw.trim())
  return match ? match[2] : null
}

/**
 * Resuelve line-height a unidades de usuario.
 * getComputedStyle normalmente ya devuelve px, pero sobre elementos que el navegador
 * no dibuja puede quedar el valor declarado. Un numero sin unidad es un multiplicador
 * del tamano de fuente, no una longitud, y "normal" son 1.2 em.
 */
export function resolveLineHeight(raw: string | null, fontSize: number): number {
  if (!raw || raw === 'normal') return fontSize * 1.2

  const trimmed = raw.trim()
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    const multiplier = parseFloat(trimmed)
    return isFinite(multiplier) && multiplier > 0 ? multiplier * fontSize : fontSize * 1.2
  }

  const parsed = parseLength(trimmed, fontSize, fontSize)
  if (parsed === null || parsed <= 0) return fontSize * 1.2
  return parsed
}

/** Numero de un atributo, con default si falta o no parsea. */
export function numericAttribute(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name)
  if (raw === null) return fallback
  const value = parseFloat(raw)
  return isFinite(value) ? value : fallback
}
