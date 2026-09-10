/**
 * Una transicion sorteada.
 *
 * La usa el splash: el saludo de arranque no tiene por que entrar siempre igual, y de paso
 * cada vez que el cliente arranca alguien ve un efecto distinto funcionando en una
 * pantalla de verdad, que es la unica prueba que vale.
 *
 * El sorteo sale de una lista curada y no de combinar efectos al voleo: `spin` con `iris`,
 * o un `roll` de 360 grados sobre un arte grande, salen mal y esto se ve solo. Cada entrada
 * de la lista es una fase entera —efectos, duracion y curva juntos— porque son esas tres
 * cosas las que hacen que un efecto quede bien, no el nombre.
 *
 * La entrada y la salida se sortean por separado, asi que las combinaciones son muchas mas
 * que las fases de la lista.
 *
 * Es la misma lista que ofrece el panel al armar un mensaje
 * (glassnote-next/src/app/admin/message/interfaces/ITransition.ts). Si se agrega un efecto
 * bueno hay que agregarlo en los dos lados; son repos distintos y no comparten codigo.
 */

import { normalizarFase } from './spec'
import { FaseTransicion, Transicion } from './tipos'

const PRESENTABLES: any[] = [
  { effects: ['fade'], duration: 1000 },
  { effects: ['fade', 'zoom'], duration: 700, easing: 'back-out', zoom: 0.6 },
  { effects: ['fade', 'slide'], duration: 700, easing: 'ease-out', side: 'b' },
  { effects: ['fade', 'slide'], duration: 700, easing: 'ease-out', side: 't' },
  { effects: ['slide'], duration: 700, easing: 'ease-out', side: 'l' },
  { effects: ['slide'], duration: 700, easing: 'ease-out', side: 'r' },
  { effects: ['wipe'], duration: 900, easing: 'ease-in-out', side: 'l' },
  { effects: ['wipe'], duration: 900, easing: 'ease-in-out', side: 'r' },
  { effects: ['iris'], duration: 800, easing: 'ease-out' },
  { effects: ['fade', 'blur'], duration: 900, easing: 'ease-out', blur: 16 },
  { effects: ['fade', 'roll'], duration: 900, easing: 'ease-out', side: 'l' },
  { effects: ['fade', 'slide'], duration: 1000, easing: 'bounce-out', side: 't' }
]

function unaCualquiera(): any {
  return PRESENTABLES[Math.floor(Math.random() * PRESENTABLES.length)]
}

/** Una fase sorteada, ya normalizada. */
export function faseAlAzar(): FaseTransicion {
  return normalizarFase(unaCualquiera())
}

/** Entrada y salida sorteadas por separado. */
export function transicionAlAzar(): Transicion {
  return { in: faseAlAzar(), out: faseAlAzar() }
}
