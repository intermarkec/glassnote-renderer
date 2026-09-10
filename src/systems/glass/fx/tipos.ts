/**
 * La forma de `transition` en el mensaje. Viaja como JSON desde la API, asi que las
 * claves estan en ingles igual que el resto de la carga (`position`, `duration`,
 * `askConfirmation`).
 *
 * La entrada y la salida son independientes: cada una elige sus propios efectos, su
 * duracion y su curva. Los efectos de una fase se combinan entre si —de ahi el arreglo—
 * y no hay un "fadein" y un "fadeout" distintos: `fade` en `in` entra y en `out` sale.
 */

/**
 * Efectos que entiende el motor. Se pueden combinar dentro de una misma fase.
 *
 * `random` es la excepcion: no se combina con nada porque no es un efecto sino un sorteo.
 * Se resuelve al normalizar —la fase entera se reemplaza por una de la lista presentable—
 * asi que nunca llega al animador.
 */
export type NombreEfecto =
  | 'random'
  | 'fade'
  | 'zoom'
  | 'slide'
  | 'roll'
  | 'spin'
  | 'blur'
  | 'wipe'
  | 'iris'

/** Izquierda, derecha, arriba, abajo. */
export type Lado = 'l' | 'r' | 't' | 'b'

/** Una fase ya normalizada: sin huecos, lista para animar. */
export interface FaseTransicion {
  /** Vacio = sin efecto: aparece y desaparece de golpe. */
  effects: NombreEfecto[]
  /** Milisegundos. */
  duration: number
  /** Milisegundos antes de arrancar. */
  delay: number
  /** Nombre de curva; se resuelve a CSS en curvas.ts. */
  easing: string
  /** Escala de partida (entrada) o de llegada (salida). 0.6 achica, 1.4 agranda. */
  zoom: number
  /**
   * Lado que usan `slide`, `roll` y `wipe`. `null` = cada efecto pone el suyo, porque no
   * es el mismo para todos: un slide sin lado sube desde abajo y un roll entra rodando
   * desde la izquierda.
   */
  side: Lado | null
  /** Grados de giro de `spin` y `roll`. `null` = el que trae cada efecto. */
  spin: number | null
  /** Pixeles de desenfoque. */
  blur: number
}

export interface Transicion {
  in: FaseTransicion
  out: FaseTransicion
}
