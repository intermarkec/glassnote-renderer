/**
 * Las fases que valen para un aviso en una pantalla.
 *
 * De aca sale todo lo que se sortea: el efecto `random` de un mensaje y el saludo de
 * arranque. Es una lista curada y no una combinacion al voleo porque `spin` con `iris`, o
 * un giro de 360 grados sobre un arte grande, salen mal y eso se ve solo. Cada entrada es
 * una fase entera —efectos, duracion y curva juntos— porque son las tres cosas las que
 * hacen que un efecto quede bien, no el nombre.
 *
 * Vive en su propio archivo y sin importar nada para que la pueda leer tanto `spec.ts`
 * —que resuelve `random` al normalizar— como `azar.ts`, sin que se importen en circulo.
 *
 * Es la misma lista que ofrece el panel al armar un mensaje
 * (glassnote-next/src/app/admin/message/interfaces/ITransition.ts). Si se agrega un efecto
 * bueno hay que agregarlo en los dos lados; son repos distintos y no comparten codigo.
 */

/** Fases sin normalizar: las normaliza quien las use. */
export const FASES_PRESENTABLES: any[] = [
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

/** Una de la lista, sin normalizar. */
export function unaFasePresentable(): any {
  return FASES_PRESENTABLES[Math.floor(Math.random() * FASES_PRESENTABLES.length)]
}
