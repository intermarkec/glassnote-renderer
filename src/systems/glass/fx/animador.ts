/**
 * El que mueve el glass.
 *
 * Dos cosas que hay que tener presentes para entender por que esta escrito asi:
 *
 * 1. `.glass-content` YA usa `transform` para colocarse (PositionManager le pone el
 *    translate del ancla) y `transform-origin` apunta a ese ancla. Los efectos se agregan
 *    DESPUES del translate de posicion, nunca antes: en `translate(pos) scale(s)` el punto
 *    de origen queda quieto pase lo que pase con la escala, y en `scale(s) translate(pos)`
 *    el arte se corre solo un poco cada vez que cambia el zoom. Es la diferencia entre un
 *    glass que crece desde su sitio y uno que ademas se desplaza.
 *
 * 2. La animacion se hace con la Web Animations API y no con `transition`, porque un
 *    `transition` sobre `transform` obliga a escribir el estado inicial, forzar un
 *    reflow y recien ahi escribir el final; con dos fases combinables y propiedades que
 *    no son solo opacidad eso se vuelve una carrera. Ademas WAAPI deja cancelar la
 *    entrada a mitad de camino cuando el mensaje se baja antes de tiempo.
 *
 * El desplazamiento de `slide` se calcula en pixeles contra la ventana, no en porcentaje
 * del propio arte: un mensaje chico en el centro tiene que entrar desde AFUERA de la
 * pantalla, y `translate(-100%)` solo lo saca de su propio ancho.
 */

import { curvaCss } from './curvas'
import { FaseTransicion, Lado } from './tipos'

/** Lo que se le anima al elemento. Nombres en camelCase porque van a un keyframe. */
interface Estado {
  opacity: string
  transform: string
  filter: string
  clipPath: string
}

export interface OpcionesFase {
  /** El translate de posicion, sin `translateZ(0)`. Puede venir vacio. */
  transformBase: string
  /** La opacidad con la que se queda el glass: la transparencia del mensaje. */
  opacidadFinal: number
}

/** Un giro completo de `spin` a secas; `roll` entra rodando menos de media vuelta. */
const GIRO_SPIN = 180
const GIRO_ROLL = 120

/** Sin lado declarado: el slide sube desde abajo, el roll y la cortinilla vienen de la izquierda. */
const LADO_SLIDE: Lado = 'b'
const LADO_ROLL: Lado = 'l'
const LADO_WIPE: Lado = 'l'

function tiene(fase: FaseTransicion, efecto: string): boolean {
  return fase.effects.indexOf(efecto as any) !== -1
}

/**
 * Cuanto hay que correr el elemento para dejarlo justo afuera de la pantalla por un lado.
 * Se mide sobre el rectangulo que ocupa YA colocado, asi que sirve igual para un arte que
 * llena el ancho y para uno chico pegado a una esquina.
 */
function desplazamientoFuera(rect: DOMRect, lado: Lado): { x: number; y: number } {
  const margen = 2 // un pelo de mas para que no asome el borde al redondear

  if (lado === 'l') return { x: -(rect.right + margen), y: 0 }
  if (lado === 'r') return { x: window.innerWidth - rect.left + margen, y: 0 }
  if (lado === 't') return { x: 0, y: -(rect.bottom + margen) }
  return { x: 0, y: window.innerHeight - rect.top + margen }
}

/** El recorte que deja el arte tapado, listo para abrirse hacia el lado contrario. */
function recorteCerrado(lado: Lado): string {
  if (lado === 'l') return 'inset(0% 100% 0% 0%)'
  if (lado === 'r') return 'inset(0% 0% 0% 100%)'
  if (lado === 't') return 'inset(0% 0% 100% 0%)'
  return 'inset(100% 0% 0% 0%)'
}

/**
 * Los dos extremos de la fase: el arte en su sitio y el arte desplazado.
 *
 * Las dos tienen que declarar las MISMAS propiedades. Un `clip-path` que va de un `inset`
 * a `none` no interpola —salta al final— y un `filter` de `blur(8px)` a `none` tampoco:
 * por eso el reposo dice `blur(0px)` y `inset(0% 0% 0% 0%)` en vez de no decir nada.
 */
function construirEstados(
  elemento: HTMLElement,
  fase: FaseTransicion,
  opciones: OpcionesFase
): { reposo: Estado; desplazado: Estado } {
  const base = opciones.transformBase ? opciones.transformBase.trim() + ' ' : ''
  const opacidad = String(opciones.opacidadFinal)

  const reposo: Estado = {
    opacity: opacidad,
    transform: (base + 'translateZ(0)').trim(),
    filter: 'none',
    clipPath: 'none'
  }

  const partes: string[] = []
  let opacidadDesplazada = opacidad
  let filtro = 'none'
  let recorte = 'none'

  const rect = elemento.getBoundingClientRect()

  if (tiene(fase, 'fade')) {
    opacidadDesplazada = '0'
  }

  if (tiene(fase, 'slide') || tiene(fase, 'roll')) {
    const lado = fase.side || (tiene(fase, 'roll') && !tiene(fase, 'slide') ? LADO_ROLL : LADO_SLIDE)
    const fuera = desplazamientoFuera(rect, lado)
    partes.push('translate(' + Math.round(fuera.x) + 'px, ' + Math.round(fuera.y) + 'px)')
  }

  if (tiene(fase, 'spin') || tiene(fase, 'roll')) {
    let grados = fase.spin
    if (grados === null) {
      grados = tiene(fase, 'spin') ? GIRO_SPIN : GIRO_ROLL
      // Rodando: el sentido lo decide de que lado viene, como rueda una rueda.
      if (!tiene(fase, 'spin') && (fase.side || LADO_ROLL) === 'l') grados = -grados
    }
    partes.push('rotate(' + grados + 'deg)')
  }

  if (tiene(fase, 'zoom')) {
    partes.push('scale(' + fase.zoom + ')')
  }

  if (tiene(fase, 'blur')) {
    filtro = 'blur(' + fase.blur + 'px)'
    reposo.filter = 'blur(0px)'
  }

  if (tiene(fase, 'wipe')) {
    recorte = recorteCerrado(fase.side || LADO_WIPE)
    reposo.clipPath = 'inset(0% 0% 0% 0%)'
  }

  if (tiene(fase, 'iris')) {
    // 70.71% del radio de referencia ya cubre las esquinas; 100% las cubre de sobra y no
    // recorta nada, que es lo que hace falta en el reposo.
    recorte = 'circle(0% at 50% 50%)'
    reposo.clipPath = 'circle(100% at 50% 50%)'
  }

  const desplazado: Estado = {
    opacity: opacidadDesplazada,
    transform: (base + partes.join(' ') + ' translateZ(0)').replace(/\s+/g, ' ').trim(),
    filter: filtro === 'none' ? reposo.filter : filtro,
    clipPath: recorte === 'none' ? reposo.clipPath : recorte
  }

  return { reposo: reposo, desplazado: desplazado }
}

function aplicar(elemento: HTMLElement, estado: Estado): void {
  elemento.style.opacity = estado.opacity
  elemento.style.transform = estado.transform
  elemento.style.filter = estado.filter
  elemento.style.clipPath = estado.clipPath
}

/** Corta cualquier animacion de fase que este corriendo sobre el elemento. */
export function cancelarAnimaciones(elemento: HTMLElement): void {
  if (typeof (elemento as any).getAnimations !== 'function') return

  const animaciones = elemento.getAnimations()
  for (let i = 0; i < animaciones.length; i++) {
    try {
      animaciones[i].cancel()
    } catch (error) {
      // Una animacion ya terminada tira al cancelarla en algunos motores. No importa.
    }
  }
}

/**
 * Anima una fase y avisa cuando termino.
 *
 * `sentido` decide para que lado va: la entrada arranca desplazada y llega al sitio, la
 * salida arranca de donde el arte este —casi siempre su sitio— y se va. Es el mismo par
 * de estados leido al reves, que es lo que hace que una salida sea la entrada dada vuelta.
 */
export function animarFase(
  elemento: HTMLElement,
  fase: FaseTransicion,
  sentido: 'entrada' | 'salida',
  opciones: OpcionesFase
): Promise<void> {
  const entrando = sentido === 'entrada'

  // Lo que se ve AHORA se lee antes de cancelar nada: cancelar devuelve el elemento al
  // estilo que tiene escrito, y durante una entrada a medio camino ese estilo todavia es
  // el de partida —invisible—. Una salida que arranque de ahi pega un salto.
  const visible = entrando ? null : getComputedStyle(elemento)
  const opacidadVisible = visible ? visible.opacity : ''
  const transformVisible = visible && visible.transform !== 'none' ? visible.transform : ''
  const filtroVisible = visible && visible.filter !== 'none' ? visible.filter : ''

  // Y recien despues se mide: sobre un elemento que se esta moviendo el rectangulo es el
  // del cuadro que toco, no el del sitio donde el arte queda, y el desplazamiento de un
  // `slide` saldria calculado contra la posicion equivocada.
  cancelarAnimaciones(elemento)

  const estados = construirEstados(elemento, fase, opciones)
  const destino = entrando ? estados.reposo : estados.desplazado

  // El recorte queda afuera de este arreglo a proposito: `clip-path` no interpola desde
  // `none`, asi que la salida siempre arranca del recorte en reposo de su propia fase.
  const partida: Estado = entrando
    ? estados.desplazado
    : {
        opacity: opacidadVisible || estados.reposo.opacity,
        transform: transformVisible || estados.reposo.transform,
        filter: filtroVisible || estados.reposo.filter,
        clipPath: estados.reposo.clipPath
      }

  const sinEfecto = fase.effects.length === 0 || fase.duration <= 0
  const sinSoporte = typeof elemento.animate !== 'function'

  if (sinEfecto || sinSoporte) {
    if (fase.delay > 0 && sinEfecto) {
      return new Promise(function (resolver) {
        setTimeout(function () {
          aplicar(elemento, destino)
          resolver()
        }, fase.delay)
      })
    }
    aplicar(elemento, destino)
    return Promise.resolve()
  }

  const cuadros = [partida as any, destino as any]

  let animacion: Animation
  try {
    animacion = elemento.animate(cuadros, {
      duration: fase.duration,
      delay: fase.delay,
      easing: curvaCss(fase.easing),
      // `both` para que el estado inicial ya este puesto durante el delay: si no, el arte
      // aparece en su sitio, espera, y recien ahi salta al lugar de donde tenia que venir.
      fill: 'both'
    })
  } catch (error) {
    console.warn('transicion: no se pudo animar, se aplica el estado final:', error)
    aplicar(elemento, destino)
    return Promise.resolve()
  }

  return new Promise(function (resolver) {
    let resuelto = false
    const terminar = function () {
      if (resuelto) return
      resuelto = true

      if (entrando) {
        // El estado final pasa a ser estilo del elemento y la animacion se descarta. Si
        // quedara viva con `fill: both` le ganaria a cualquier estilo que se escriba
        // despues, y la salida —que escribe transform y opacidad— no se veria.
        aplicar(elemento, estados.reposo)
        try {
          animacion.cancel()
        } catch (error) {
          // ya estaba cancelada
        }
      }

      resolver()
    }

    animacion.addEventListener('finish', terminar)
    animacion.addEventListener('cancel', function () {
      // Cancelada desde afuera: el elemento se queda como estaba y quien espera sigue.
      if (resuelto) return
      resuelto = true
      resolver()
    })

    // Red de seguridad: si el motor no dispara `finish` —pestana oculta, animacion
    // descartada— el glass no puede quedarse colgado para siempre.
    setTimeout(terminar, fase.duration + fase.delay + 250)
  })
}
