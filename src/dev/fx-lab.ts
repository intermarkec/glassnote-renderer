// Banco de pruebas de los efectos de entrada y salida. Solo para desarrollo: se abre con
// `npm run dev` en /fx-lab.html y no entra en el build, que solo toma index.html.
//
// Arma un glass de mentira con la misma mecanica que glass-system —el mismo
// PositionManager, el mismo transform base, el mismo motor de efectos— y lo hace entrar y
// salir con lo que se elija arriba. Sirve para ver como queda una combinacion sin mandar
// un mensaje a un equipo.

import { PositionManager } from '../systems/glass/position-manager'
import { ScaleCalculator } from '../systems/glass/scale-calculator'
import { animarFase, cancelarAnimaciones, normalizarFase, transicionAlAzar, CURVAS_DISPONIBLES, EFECTOS_DISPONIBLES } from '../systems/glass/fx'
// La Kinetika del splash. Sin esto el logotipo cae en la fuente por omision del navegador
// y el arte del banco no es el arte que se ve en un equipo.
import '../fonts/kinetika.css'


interface EstadoFase {
  effects: string[]
  duration: number
  delay: number
  easing: string
  zoom: number
  side: string
  spin: string
  blur: number
}

/**
 * El arte del banco es el splash del cliente: el mismo `public/splash.html` que el
 * renderer dibuja al arrancar. No es un rectangulo de mentira a proposito —un efecto se
 * ve distinto sobre una forma con transparencia que sobre un bloque de color— y ademas es
 * lo unico que esta siempre a mano, sin depender de la API ni de un upload.
 *
 * Sus medidas salen del propio archivo (el div raiz las declara en px) y la escala la
 * calcula ScaleCalculator, el mismo que usa el renderer de verdad.
 */
const SPLASH = '/splash.html'

let splash: { html: string; ancho: number; alto: number } | null = null

async function cargarSplash(): Promise<void> {
  const respuesta = await fetch(SPLASH)
  // %VERSION% lo sustituye el renderer con la version que corre; aca no hay ninguna.
  const html = (await respuesta.text()).replace(/%VERSION%/g, 'lab')

  const caja = document.createElement('div')
  caja.innerHTML = html
  const raiz = caja.querySelector('div')

  splash = {
    html: html,
    ancho: parseInt(raiz?.style.width || '432', 10) || 432,
    alto: parseInt(raiz?.style.height || '420', 10) || 420
  }
}

const estado: { in: EstadoFase; out: EstadoFase } = {
  in: { effects: ['fade'], duration: 1000, delay: 0, easing: 'ease-in-out', zoom: 0.6, side: '', spin: '', blur: 12 },
  out: { effects: ['fade'], duration: 1000, delay: 0, easing: 'ease-in-out', zoom: 0.6, side: '', spin: '', blur: 12 }
}

// El splash sale abajo a la derecha en el cliente, asi que el banco arranca igual.
let posicion = { h: 2, v: 2 }
let transparencia = 1
let glass: HTMLElement | null = null
let transformBase = ''

const positionManager = new PositionManager()
const scaleCalculator = new ScaleCalculator()
const escenario = document.getElementById('escenario') as HTMLElement
const salidaJson = document.getElementById('json') as HTMLElement

/** Lo mismo que hace el renderer: ScaleCalculator decide, no el banco. */
function medidas(): { ancho: number; alto: number; ratio: number } {
  const base = splash || { ancho: 432, alto: 420 }
  const escala = scaleCalculator.calculateScaledDimensions(
    base.ancho,
    base.alto,
    scaleCalculator.calculateScaleFactor()
  )

  return { ancho: escala.width, alto: escala.height, ratio: escala.ratio }
}

function bajarGlass(): void {
  if (!glass) return
  cancelarAnimaciones(glass)
  if (glass.parentNode) glass.parentNode.removeChild(glass)
  glass = null
}

/** Un `.glass-content` armado igual que el de glass-system, con un arte de mentira dentro. */
function ponerGlass(): HTMLElement {
  bajarGlass()

  const contenido = document.createElement('div')
  contenido.className = 'glass-content'
  Object.assign(contenido.style, {
    position: 'absolute',
    opacity: '0',
    willChange: 'transform, opacity, filter, clip-path',
    transform: 'translateZ(0)',
    zIndex: '10001'
  })

  positionManager.positionElement(contenido, posicion)
  const pos = positionManager.getPositionStrings(posicion)
  contenido.style.transformOrigin = pos.hOrigin + ' ' + pos.vOrigin
  transformBase = positionManager.getPositionStyles(posicion).transform

  const tamano = medidas()
  const arte = document.createElement('div')
  arte.className = 'arte'
  arte.style.width = tamano.ancho + 'px'
  arte.style.height = tamano.alto + 'px'
  arte.style.overflow = 'hidden'

  // El splash trae sus medidas en px; se encoge con un scale desde la esquina, que es lo
  // que hace el renderer con el HTML adentro de su iframe.
  const dentro = document.createElement('div')
  dentro.innerHTML = splash ? splash.html : ''
  dentro.style.transformOrigin = 'top left'
  dentro.style.transform = 'scale(' + tamano.ratio + ')'
  arte.appendChild(dentro)

  contenido.appendChild(arte)
  escenario.appendChild(contenido)
  glass = contenido

  return contenido
}

function faseNormalizada(cual: 'in' | 'out') {
  const bruta: any = {
    effects: estado[cual].effects.slice(),
    duration: estado[cual].duration,
    delay: estado[cual].delay,
    easing: estado[cual].easing,
    zoom: estado[cual].zoom,
    blur: estado[cual].blur
  }
  if (estado[cual].side) bruta.side = estado[cual].side
  if (estado[cual].spin !== '') bruta.spin = parseFloat(estado[cual].spin)

  return normalizarFase(bruta)
}

function transicionJson(): any {
  const armar = function (cual: 'in' | 'out') {
    const fase: any = {
      effects: estado[cual].effects.slice(),
      duration: estado[cual].duration
    }
    if (estado[cual].delay) fase.delay = estado[cual].delay
    if (estado[cual].easing !== 'ease-in-out') fase.easing = estado[cual].easing
    if (estado[cual].effects.indexOf('zoom') !== -1) fase.zoom = estado[cual].zoom
    if (estado[cual].effects.indexOf('blur') !== -1) fase.blur = estado[cual].blur
    if (estado[cual].side) fase.side = estado[cual].side
    if (estado[cual].spin !== '') fase.spin = parseFloat(estado[cual].spin)
    return fase
  }

  return { in: armar('in'), out: armar('out') }
}

function pintarJson(): void {
  salidaJson.textContent = JSON.stringify(transicionJson(), null, 2)
}

function entrar(): Promise<void> {
  const contenido = ponerGlass()
  // Dos cuadros para que el arte tenga medidas antes de medir el desplazamiento, igual
  // que hace glass-system.
  return new Promise(function (resolver) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        animarFase(contenido, faseNormalizada('in'), 'entrada', {
          transformBase: transformBase,
          opacidadFinal: transparencia
        }).then(resolver)
      })
    })
  })
}

function salir(): Promise<void> {
  if (!glass) return Promise.resolve()
  const contenido = glass

  return animarFase(contenido, faseNormalizada('out'), 'salida', {
    transformBase: transformBase,
    opacidadFinal: transparencia
  }).then(function () {
    if (glass === contenido) bajarGlass()
  })
}

function ciclo(): void {
  entrar().then(function () {
    setTimeout(salir, 1200)
  })
}

// ---------------------------------------------------------------- controles

function etiqueta(texto: string, control: HTMLElement): HTMLElement {
  const label = document.createElement('label')
  label.appendChild(document.createTextNode(texto))
  label.appendChild(control)
  return label
}

function numero(cual: 'in' | 'out', campo: 'duration' | 'delay' | 'zoom' | 'blur', paso: number): HTMLElement {
  const input = document.createElement('input')
  input.type = 'number'
  input.step = paso + ''
  input.value = estado[cual][campo] + ''
  input.addEventListener('input', function () {
    const valor = parseFloat(input.value)
    if (isFinite(valor)) {
      ;(estado[cual] as any)[campo] = valor
      pintarJson()
    }
  })
  return input
}

function seleccion(opciones: { valor: string; texto: string }[], valor: string, alCambiar: (v: string) => void): HTMLElement {
  const select = document.createElement('select')
  for (let i = 0; i < opciones.length; i++) {
    const option = document.createElement('option')
    option.value = opciones[i].valor
    option.textContent = opciones[i].texto
    if (opciones[i].valor === valor) option.selected = true
    select.appendChild(option)
  }
  select.addEventListener('change', function () {
    alCambiar(select.value)
    pintarJson()
  })
  return select
}

function panelDeFase(cual: 'in' | 'out', titulo: string): HTMLElement {
  const caja = document.createElement('fieldset')
  const leyenda = document.createElement('legend')
  leyenda.textContent = titulo
  caja.appendChild(leyenda)

  const efectos = document.createElement('div')
  efectos.className = 'efectos'
  for (let i = 0; i < EFECTOS_DISPONIBLES.length; i++) {
    const nombre = EFECTOS_DISPONIBLES[i]
    const casilla = document.createElement('input')
    casilla.type = 'checkbox'
    casilla.checked = estado[cual].effects.indexOf(nombre) !== -1
    casilla.addEventListener('change', function () {
      const lista = estado[cual].effects
      const donde = lista.indexOf(nombre)
      if (casilla.checked && donde === -1) lista.push(nombre)
      if (!casilla.checked && donde !== -1) lista.splice(donde, 1)
      pintarJson()
    })
    efectos.appendChild(etiqueta(nombre, casilla))
  }
  caja.appendChild(efectos)

  const fila = document.createElement('div')
  fila.className = 'fila'
  fila.appendChild(etiqueta('duracion', numero(cual, 'duration', 50)))
  fila.appendChild(etiqueta('delay', numero(cual, 'delay', 50)))
  fila.appendChild(etiqueta('zoom', numero(cual, 'zoom', 0.1)))
  fila.appendChild(etiqueta('blur', numero(cual, 'blur', 1)))
  caja.appendChild(fila)

  const fila2 = document.createElement('div')
  fila2.className = 'fila'
  fila2.appendChild(etiqueta('curva', seleccion(
    CURVAS_DISPONIBLES.map(function (c) { return { valor: c, texto: c } }),
    estado[cual].easing,
    function (v) { estado[cual].easing = v }
  )))
  fila2.appendChild(etiqueta('lado', seleccion(
    [
      { valor: '', texto: 'el del efecto' },
      { valor: 'l', texto: 'izquierda' },
      { valor: 'r', texto: 'derecha' },
      { valor: 't', texto: 'arriba' },
      { valor: 'b', texto: 'abajo' }
    ],
    estado[cual].side,
    function (v) { estado[cual].side = v }
  )))
  fila2.appendChild(etiqueta('giro', seleccion(
    [
      { valor: '', texto: 'el del efecto' },
      { valor: '90', texto: '90' },
      { valor: '180', texto: '180' },
      { valor: '360', texto: '360' },
      { valor: '-120', texto: '-120' },
      { valor: '-360', texto: '-360' }
    ],
    estado[cual].spin,
    function (v) { estado[cual].spin = v }
  )))
  caja.appendChild(fila2)

  return caja
}

function panelDeEscena(): HTMLElement {
  const caja = document.createElement('fieldset')
  const leyenda = document.createElement('legend')
  leyenda.textContent = 'Escena'
  caja.appendChild(leyenda)

  const fila = document.createElement('div')
  fila.className = 'fila'

  fila.appendChild(etiqueta('h', seleccion(
    [{ valor: '0', texto: 'izquierda' }, { valor: '1', texto: 'centro' }, { valor: '2', texto: 'derecha' }],
    posicion.h + '',
    function (v) { posicion = { h: parseInt(v), v: posicion.v } }
  )))

  fila.appendChild(etiqueta('v', seleccion(
    [{ valor: '0', texto: 'arriba' }, { valor: '1', texto: 'centro' }, { valor: '2', texto: 'abajo' }],
    posicion.v + '',
    function (v) { posicion = { h: posicion.h, v: parseInt(v) } }
  )))

  fila.appendChild(etiqueta('transparencia', seleccion(
    [{ valor: '1', texto: '1' }, { valor: '0.9', texto: '0.9' }, { valor: '0.6', texto: '0.6' }],
    transparencia + '',
    function (v) { transparencia = parseFloat(v) }
  )))

  caja.appendChild(fila)
  return caja
}

function boton(texto: string, alTocar: () => void): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = texto
  button.addEventListener('click', alTocar)
  return button
}

/** Deja los controles mostrando la fase que se sorteo, para poder repetirla o retocarla. */
function volcarFase(cual: 'in' | 'out', fase: any): void {
  estado[cual].effects = fase.effects.slice()
  estado[cual].duration = fase.duration
  estado[cual].delay = fase.delay
  estado[cual].easing = fase.easing
  estado[cual].zoom = fase.zoom
  estado[cual].blur = fase.blur
  estado[cual].side = fase.side || ''
  estado[cual].spin = fase.spin === null ? '' : String(fase.spin)
}

let redibujarControles: () => void = function () {}

function armarPanel(): void {
  const panel = document.getElementById('controles') as HTMLElement

  let cajaEntrada = panelDeFase('in', 'Entrada')
  let cajaSalida = panelDeFase('out', 'Salida')

  panel.appendChild(panelDeEscena())
  panel.appendChild(cajaEntrada)
  panel.appendChild(cajaSalida)

  // Los controles se arman una vez leyendo el estado, asi que la unica forma de que
  // muestren una fase que vino de afuera —la sorteada— es volver a armarlos.
  redibujarControles = function () {
    const nuevaEntrada = panelDeFase('in', 'Entrada')
    const nuevaSalida = panelDeFase('out', 'Salida')

    panel.replaceChild(nuevaEntrada, cajaEntrada)
    panel.replaceChild(nuevaSalida, cajaSalida)
    cajaEntrada = nuevaEntrada
    cajaSalida = nuevaSalida

    pintarJson()
  }

  const acciones = document.createElement('div')
  acciones.className = 'acciones'
  const entrada = boton('Entrar', function () { entrar() })
  entrada.className = 'principal'
  acciones.appendChild(entrada)
  acciones.appendChild(boton('Salir', function () { salir() }))
  acciones.appendChild(boton('Ciclo', ciclo))
  // Lo mismo que hace el splash al arrancar: sortear una entrada y una salida de la lista
  // presentable. Sirve para ver que sale de ahi sin tener que reiniciar el cliente.
  acciones.appendChild(boton('Al azar', function () {
    const sorteada = transicionAlAzar()
    volcarFase('in', sorteada.in)
    volcarFase('out', sorteada.out)
    redibujarControles()
    ciclo()
  }))
  acciones.appendChild(boton('Limpiar', bajarGlass))
  // Para pegarlo en "Avanzado" del panel: el banco es el editor de efectos y el panel
  // solo elige.
  acciones.appendChild(boton('Copiar JSON', function () {
    const texto = JSON.stringify(transicionJson(), null, 2)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).catch(function (error) {
        console.warn('[lab] no se pudo copiar:', error)
      })
    }
  }))
  panel.appendChild(acciones)

  pintarJson()
}

cargarSplash()
  .catch(function (error) {
    console.error('[lab] no se pudo cargar el splash:', error)
  })
  .then(armarPanel)
