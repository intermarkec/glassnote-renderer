/**
 * ¿Este renderer esta corriendo como previsualizacion embebida en una pagina?
 *
 * Va aparte del resto del modo previsualizacion —y sin importar nada— porque lo consultan
 * modulos que se cargan al principio de todo (los servicios, dom-events) y no tienen por
 * que arrastrar el sistema de glass para poder preguntarlo.
 */
let encendido: boolean | null = null

export function esPreview(): boolean {
  if (encendido === null) {
    try {
      encendido = new URLSearchParams(window.location.search).get('preview') === '1'
    } catch (error) {
      encendido = false
    }
  }
  return encendido
}
