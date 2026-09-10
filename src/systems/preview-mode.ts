/**
 * Modo previsualizacion: el renderer corriendo dentro de un <iframe> del panel web, para
 * ver como queda un mensaje sin mandarselo a un equipo.
 *
 * Se enciende con ?preview=1 en la URL. Encendido, el renderer deja de ser un cliente:
 * no conecta a ningun servidor y no muestra el splash. Tampoco reporta nada: el glass
 * avisa por el websocket de su servidor y aca no hay ninguno, asi que sus notify mueren
 * solos (glass-system._sendNotification). Lo unico que hace es esperar que la pagina que
 * lo embebe le pase un mensaje por postMessage y dibujarlo.
 *
 * Para los equipos en produccion este archivo no existe: sin ?preview=1 no engancha nada.
 */

import { Glass } from './glass-system'
import { esPreview } from '../utils/preview'

// Lo que manda la pagina.
const MOSTRAR = 'glassnote-preview-mostrar'
const LIMPIAR = 'glassnote-preview-limpiar'
// Lo que contesta el renderer.
const LISTO = 'glassnote-preview-listo'
const TERMINO = 'glassnote-preview-termino'

let glassEnPantalla: Glass | null = null

/**
 * Baja el glass que este puesto. Sale por `retirar` y no por `destroy` porque esto no es
 * haberlo cumplido: es una previsualizacion que reemplazan por otra.
 */
function bajarLoQueEste(): void {
  if (!glassEnPantalla) return
  const glass = glassEnPantalla
  glassEnPantalla = null
  try {
    glass.retirar()
  } catch (error) {
    console.error('preview: no se pudo bajar el glass anterior:', error)
  }
}

function avisar(evento: string, extra?: Record<string, any>): void {
  try {
    window.parent?.postMessage({ evento, ...(extra || {}) }, '*')
  } catch (error) {
    console.error('preview: no se pudo avisar a la pagina:', error)
  }
}

function mostrar(data: any): void {
  if (!data) return

  bajarLoQueEste()

  // La clase de verdad y no window.Glass: eso es la cola unificada, que antes de dibujar
  // pide pantalla disponible, presencia y la posicion libre —condiciones de un equipo que
  // recibe mensajes—. Una previsualizacion se pide a mano y se dibuja en el acto.
  //
  // Sin url de servidor: es lo que deja al glass sin websocket al que reportar.
  const glass = new Glass(null, { event: 'message', data })
  glassEnPantalla = glass

  // El aviso de que se fue le sirve a la pagina para devolver el boton a su estado
  // normal. Se engancha en cleanup, que es por donde pasa cualquier final: duracion
  // cumplida, X, o reemplazo por otra previsualizacion.
  const limpiarOriginal = glass.cleanup.bind(glass)
  glass.cleanup = function (): void {
    limpiarOriginal()
    if (glassEnPantalla === glass) glassEnPantalla = null
    avisar(TERMINO, { id: data.id })
  }
}

function escuchar(): void {
  window.addEventListener('message', function (evento: MessageEvent) {
    // Solo lo que baja de la pagina que lo embebe. Lo que sube de un iframe hijo —el
    // sandbox donde corre el arte HTML— tiene su propio camino y no pasa por aca.
    if (evento.source !== window.parent) return
    const mensaje: any = evento.data
    if (!mensaje || typeof mensaje !== 'object') return
    if (mensaje.evento === MOSTRAR) {
      mostrar(mensaje.data)
    } else if (mensaje.evento === LIMPIAR) {
      bajarLoQueEste()
    }
  })
}

if (esPreview()) {
  escuchar()
  // El aviso sale recien cuando ya hay quien escuche, asi la pagina puede contestar en el
  // acto sin que el primer mensaje se pierda.
  avisar(LISTO)
  console.log('Renderer en modo previsualizacion: sin servidores, sin splash')
}
