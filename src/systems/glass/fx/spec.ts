/**
 * Lo que llega en `transition` no siempre es lo que uno espera: puede ser el objeto ya
 * armado, el mismo objeto pasado como texto —el websocket manda `position` y `parameters`
 * asi—, el `"fade"` a secas de los mensajes viejos, o nada. Aca se convierte cualquiera de
 * esos en un par de fases completas, sin huecos, listas para animar.
 *
 * Nada de esto tira: un efecto mal escrito se ignora y una transicion entera ilegible cae
 * en el fundido de siempre. Un arte no se deja de mostrar porque alguien escribio mal el
 * nombre de un efecto.
 */

import { FaseTransicion, Lado, NombreEfecto, Transicion } from './tipos'

const EFECTOS: NombreEfecto[] = ['fade', 'zoom', 'slide', 'roll', 'spin', 'blur', 'wipe', 'iris']

/** Nombres alternativos. El de la izquierda es lo que alguien puede escribir. */
const ALIAS: Record<string, NombreEfecto> = {
  fadein: 'fade',
  fadeout: 'fade',
  fundido: 'fade',
  zoomin: 'zoom',
  zoomout: 'zoom',
  scale: 'zoom',
  escala: 'zoom',
  translate: 'slide',
  translatein: 'slide',
  translateout: 'slide',
  slidein: 'slide',
  slideout: 'slide',
  desplazar: 'slide',
  rollin: 'roll',
  rollout: 'roll',
  rodar: 'roll',
  rotate: 'spin',
  rotar: 'spin',
  girar: 'spin',
  blurin: 'blur',
  blurout: 'blur',
  desenfoque: 'blur',
  wipein: 'wipe',
  wipeout: 'wipe',
  cortinilla: 'wipe',
  iris: 'iris',
  circulo: 'iris'
}

const LADOS: Record<string, Lado> = {
  l: 'l',
  left: 'l',
  izq: 'l',
  izquierda: 'l',
  r: 'r',
  right: 'r',
  der: 'r',
  derecha: 'r',
  t: 't',
  top: 't',
  arriba: 't',
  b: 'b',
  bottom: 'b',
  abajo: 'b'
}

/** Sin transicion declarada, el glass entra y sale como siempre lo hizo. */
const PREDETERMINADOS = {
  effects: ['fade'] as NombreEfecto[],
  duration: 1000,
  delay: 0,
  easing: 'ease-in-out',
  zoom: 0.6,
  side: null as Lado | null,
  spin: null as number | null,
  blur: 12
}

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo)
}

function numero(valor: any, porOmision: number, minimo: number, maximo: number): number {
  const n = typeof valor === 'string' ? parseFloat(valor) : valor
  if (typeof n !== 'number' || !isFinite(n)) return porOmision
  return acotar(n, minimo, maximo)
}

/**
 * Un token de efecto: `zoom`, `slide-l`, `wipe-arriba`. El lado va pegado al nombre
 * porque asi se escribe de un tiron y no obliga a poner un campo aparte.
 */
function leerEfecto(texto: string): { efecto: NombreEfecto; lado: Lado | null } | null {
  const limpio = texto.trim().toLowerCase()
  if (!limpio || limpio === 'none' || limpio === 'ninguno' || limpio === 'sin') return null

  const partes = limpio.split(/[-_:]/)
  const cabeza = partes[0]
  const cola = partes.length > 1 ? partes[partes.length - 1] : ''

  // `fade-in` y `zoom-out` son la misma cosa que `fade` y `zoom`: la direccion la da la
  // fase, no el nombre. Se los deja pasar porque es como los escribe todo el mundo.
  const nombre = (EFECTOS.indexOf(limpio as NombreEfecto) !== -1 ? limpio : ALIAS[limpio.replace(/[-_]/g, '')]) as NombreEfecto
  if (nombre) return { efecto: nombre, lado: null }

  const base = (EFECTOS.indexOf(cabeza as NombreEfecto) !== -1 ? cabeza : ALIAS[cabeza]) as NombreEfecto
  if (!base) return null

  return { efecto: base, lado: LADOS[cola] || null }
}

function leerEfectos(valor: any): { efectos: NombreEfecto[]; lado: Lado | null } {
  const crudos: string[] = Array.isArray(valor)
    ? valor.map(function (item) { return String(item) })
    : typeof valor === 'string'
      ? valor.split(/[+,\s]+/)
      : []

  const efectos: NombreEfecto[] = []
  let lado: Lado | null = null

  for (let i = 0; i < crudos.length; i++) {
    const leido = leerEfecto(crudos[i])
    if (!leido) continue
    if (efectos.indexOf(leido.efecto) === -1) efectos.push(leido.efecto)
    if (leido.lado) lado = leido.lado
  }

  return { efectos: efectos, lado: lado }
}

function leerLado(valor: any): Lado | null {
  if (typeof valor !== 'string') return null
  return LADOS[valor.trim().toLowerCase()] || null
}

/** Una fase suelta -> una fase completa. */
export function normalizarFase(valor: any): FaseTransicion {
  if (!valor || typeof valor !== 'object') {
    // Un string suelto en `in` u `out` se toma como la lista de efectos.
    if (typeof valor === 'string') return normalizarFase({ effects: valor })
    return {
      effects: PREDETERMINADOS.effects.slice(),
      duration: PREDETERMINADOS.duration,
      delay: PREDETERMINADOS.delay,
      easing: PREDETERMINADOS.easing,
      zoom: PREDETERMINADOS.zoom,
      side: PREDETERMINADOS.side,
      spin: PREDETERMINADOS.spin,
      blur: PREDETERMINADOS.blur
    }
  }

  const leido = leerEfectos(valor.effects !== undefined ? valor.effects : valor.efectos)
  const ladoDeclarado = leerLado(valor.side !== undefined ? valor.side : valor.lado)
  const giro = valor.spin !== undefined ? valor.spin : valor.giro

  return {
    effects: leido.efectos,
    duration: numero(valor.duration !== undefined ? valor.duration : valor.duracion, PREDETERMINADOS.duration, 0, 10000),
    delay: numero(valor.delay !== undefined ? valor.delay : valor.demora, PREDETERMINADOS.delay, 0, 10000),
    easing: typeof valor.easing === 'string' ? valor.easing : typeof valor.curva === 'string' ? valor.curva : PREDETERMINADOS.easing,
    zoom: numero(valor.zoom, PREDETERMINADOS.zoom, 0.01, 5),
    // El lado del campo manda sobre el que venga pegado al nombre del efecto.
    side: ladoDeclarado || leido.lado,
    // `null` y ausente son lo mismo —cada efecto pone su giro— y hay que tratarlos igual:
    // una fase ya normalizada trae `spin: null`, y volver a normalizarla no puede
    // convertirlo en 0, que es un giro de verdad y deja al roll sin rodar.
    spin: giro === undefined || giro === null ? null : numero(giro, 0, -3600, 3600),
    blur: numero(valor.blur !== undefined ? valor.blur : valor.desenfoque, PREDETERMINADOS.blur, 0, 100)
  }
}

/** El fundido de un segundo: lo que hacia el renderer antes de que esto existiera. */
export function transicionPredeterminada(): Transicion {
  return { in: normalizarFase(null), out: normalizarFase(null) }
}

function aObjeto(valor: any): any {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'object') return valor

  if (typeof valor === 'string') {
    const texto = valor.trim()
    if (!texto) return null

    if (texto.charAt(0) === '{') {
      try {
        return JSON.parse(texto)
      } catch (error) {
        console.warn('transicion: no se pudo leer el JSON, se usa el fundido:', error)
        return null
      }
    }

    // `"fade"` de los mensajes viejos, o cualquier lista suelta de efectos.
    return { effects: texto }
  }

  return null
}

/**
 * Lo que sea que haya llegado -> entrada y salida completas.
 *
 * Si solo viene una de las dos fases, la otra la copia: quien puso un zoom de entrada y
 * no dijo nada de la salida espera que se vaya con el mismo zoom, no con un fundido.
 */
export function normalizarTransicion(valor: any): Transicion {
  const objeto = aObjeto(valor)
  if (!objeto) return transicionPredeterminada()

  const entrada = objeto.in !== undefined ? objeto.in : objeto.entrada
  const salida = objeto.out !== undefined ? objeto.out : objeto.salida

  // Una fase suelta sin `in`/`out` vale para las dos.
  if (entrada === undefined && salida === undefined) {
    const unica = normalizarFase(objeto)
    return { in: unica, out: normalizarFase(objeto) }
  }

  const faseEntrada = entrada !== undefined ? normalizarFase(entrada) : null
  const faseSalida = salida !== undefined ? normalizarFase(salida) : null

  return {
    in: faseEntrada || (faseSalida ? normalizarFase(salida) : normalizarFase(null)),
    out: faseSalida || (faseEntrada ? normalizarFase(entrada) : normalizarFase(null))
  }
}

export { EFECTOS as EFECTOS_DISPONIBLES }
