/**
 * Curvas de tiempo.
 *
 * Las clasicas son cubic-bezier. El rebote y el elastico no se pueden escribir con una
 * bezier —vuelven sobre si mismos mas de una vez— asi que se arman muestreando la formula
 * y escribiendola como `linear(...)`, que es una curva por puntos. `linear()` existe
 * desde Chromium 113; si el equipo tuviera uno mas viejo se cae a una bezier parecida en
 * vez de quedarse sin animacion.
 */

const CANTIDAD_DE_MUESTRAS = 40

/** Rebote de salida clasico (el de jQuery UI y animate.css). */
function reboteSaliendo(x: number): number {
  const n = 7.5625
  const d = 2.75

  if (x < 1 / d) return n * x * x
  if (x < 2 / d) {
    const t = x - 1.5 / d
    return n * t * t + 0.75
  }
  if (x < 2.5 / d) {
    const t = x - 2.25 / d
    return n * t * t + 0.9375
  }
  const t = x - 2.625 / d
  return n * t * t + 0.984375
}

function reboteEntrando(x: number): number {
  return 1 - reboteSaliendo(1 - x)
}

function elasticoSaliendo(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return Math.pow(2, -10 * x) * Math.sin(((x * 10 - 0.75) * (2 * Math.PI)) / 3) + 1
}

function elasticoEntrando(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return -Math.pow(2, 10 * x - 10) * Math.sin(((x * 10 - 10.75) * (2 * Math.PI)) / 3)
}

/** Convierte una formula en la lista de puntos que espera `linear()`. */
function porPuntos(formula: (x: number) => number): string {
  const puntos: string[] = []

  for (let i = 0; i <= CANTIDAD_DE_MUESTRAS; i++) {
    const x = i / CANTIDAD_DE_MUESTRAS
    puntos.push(Math.round(formula(x) * 10000) / 10000 + '')
  }

  return 'linear(' + puntos.join(',') + ')'
}

/** Si el motor no entiende `linear()`, lo mas parecido que si entiende. */
const RESPALDOS: Record<string, string> = {
  'bounce-in': 'cubic-bezier(0.36, 0, 0.66, -0.56)',
  'bounce-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'elastic-in': 'cubic-bezier(0.36, 0, 0.66, -0.56)',
  'elastic-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)'
}

let soportaPorPuntos: boolean | null = null

function haySoporteParaPuntos(): boolean {
  if (soportaPorPuntos !== null) return soportaPorPuntos

  try {
    soportaPorPuntos =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('animation-timing-function', 'linear(0, 1)')
  } catch (error) {
    soportaPorPuntos = false
  }

  return soportaPorPuntos as boolean
}

const CURVAS: Record<string, () => string> = {
  linear: () => 'linear',
  ease: () => 'ease',
  'ease-in': () => 'ease-in',
  'ease-out': () => 'ease-out',
  'ease-in-out': () => 'ease-in-out',
  // Se pasa de largo y vuelve: el "pop" de una notificacion.
  'back-in': () => 'cubic-bezier(0.36, 0, 0.66, -0.56)',
  'back-out': () => 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  'back-in-out': () => 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
  'bounce-in': () => porPuntos(reboteEntrando),
  'bounce-out': () => porPuntos(reboteSaliendo),
  'elastic-in': () => porPuntos(elasticoEntrando),
  'elastic-out': () => porPuntos(elasticoSaliendo)
}

/** Los nombres validos, para el panel y para el banco de pruebas. */
export const CURVAS_DISPONIBLES = Object.keys(CURVAS)

const PREDETERMINADA = 'ease-in-out'

/** Nombre de curva -> valor CSS. Lo que no se reconoce cae en la predeterminada. */
export function curvaCss(nombre: string | null | undefined): string {
  const clave = (nombre || '').trim().toLowerCase()
  const curva = CURVAS[clave]

  if (!curva) return CURVAS[PREDETERMINADA]()
  if (RESPALDOS[clave] && !haySoporteParaPuntos()) return RESPALDOS[clave]

  return curva()
}
