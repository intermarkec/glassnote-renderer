/**
 * Una transicion sorteada.
 *
 * La usa el splash: el saludo de arranque no tiene por que entrar siempre igual, y de paso
 * cada vez que el cliente arranca alguien ve un efecto distinto funcionando en una
 * pantalla de verdad, que es la unica prueba que vale.
 *
 * Un mensaje consigue lo mismo pidiendo el efecto `random`, que se resuelve al normalizar
 * (spec.ts). Las dos puertas dan a la misma lista: `presentables.ts`.
 *
 * La entrada y la salida se sortean por separado, asi que las combinaciones son muchas mas
 * que las fases de la lista.
 */

import { unaFasePresentable } from './presentables'
import { normalizarFase } from './spec'
import { FaseTransicion, Transicion } from './tipos'

/** Una fase sorteada, ya normalizada. */
export function faseAlAzar(): FaseTransicion {
  return normalizarFase(unaFasePresentable())
}

/** Entrada y salida sorteadas por separado. */
export function transicionAlAzar(): Transicion {
  return { in: faseAlAzar(), out: faseAlAzar() }
}
