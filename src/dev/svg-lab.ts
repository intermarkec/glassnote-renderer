// Banco de pruebas del parser de SVG. Solo para desarrollo: se abre con
// `npm run dev` en /svg-lab.html y no entra en el build, que solo toma index.html.
//
// Muestra cada plantilla dos veces: como la dibuja el navegador hoy y como queda
// despues de pasar por el motor. Sirve para comparar contra el render de Inkscape.

import { SvgTextEngine, SvgParam } from '../systems/glass/svg/index'

interface Caso {
  archivo: string
  titulo: string
  noticia?: boolean
}

const CASOS: Caso[] = [
  { archivo: 'inkscape-shape-inside.svg', titulo: 'Inkscape 1.x, shape-inside, justificado' },
  { archivo: 'inkscape-flowroot.svg', titulo: 'Inkscape 0.92, flowRoot, centrado' },
  { archivo: 'inkscape-inline-size.svg', titulo: 'Inkscape 1.x, inline-size, centrado' },
  { archivo: 'alineaciones.svg', titulo: 'Las cuatro alineaciones y la reduccion' },
  { archivo: 'variable-partida.svg', titulo: 'Variable partida entre dos tspan' },
  { archivo: 'ia-generado.svg', titulo: 'SVG de IA: <style>, clases y XML mal formado' },
  { archivo: 'noticias.svg', titulo: 'Marquesina: texto suelto y texto con marco', noticia: true },
  { archivo: 'inkscape-complejo.svg', titulo: 'Fidelidad: grupos, recortes, mascara, filtro y degradados' },
  { archivo: 'illustrator.svg', titulo: 'Fidelidad: export de Illustrator con <style> y clases' }
]

const PREDETERMINADOS: Record<string, string> = {
  '%NOMBRE%': 'Maria Fernanda Villavicencio',
  '%ASUNTO%': 'su solicitud fue aprobada el dia de hoy',
  '%TEXTO%': 'El texto se reparte en lineas dentro del marco y respeta la alineacion.',
  '%DETALLE%': 'Linea de detalle'
}

const campos: Record<string, HTMLInputElement> = {}

function parametros(): SvgParam[] {
  const params: SvgParam[] = []
  const etiquetas = Object.keys(PREDETERMINADOS)

  for (let i = 0; i < etiquetas.length; i++) {
    const etiqueta = etiquetas[i]
    const campo = campos[etiqueta]
    params.push({ label: etiqueta, value: campo ? campo.value : PREDETERMINADOS[etiqueta] })
  }

  return params
}

/** Mismo parseo que usa el procesador: XML primero, HTML como respaldo tolerante. */
function parsear(contenido: string): SVGSVGElement | null {
  try {
    const doc = new DOMParser().parseFromString(contenido, 'image/svg+xml')
    const fallo = doc.getElementsByTagName('parsererror').length > 0
    const raiz = doc.documentElement

    if (!fallo && raiz && raiz.nodeName.toLowerCase() === 'svg') {
      return document.importNode(raiz, true) as unknown as SVGSVGElement
    }
  } catch (error) {
    console.warn('[lab] DOMParser fallo:', error)
  }

  const contenedor = document.createElement('div')
  contenedor.innerHTML = contenido
  return contenedor.querySelector('svg')
}

function lado(titulo: string): HTMLDivElement {
  const div = document.createElement('div')
  div.className = 'lado'
  const h3 = document.createElement('h3')
  h3.textContent = titulo
  div.appendChild(h3)
  return div
}

async function pintar(): Promise<void> {
  const contenedor = document.getElementById('casos')
  if (!contenedor) return
  contenedor.innerHTML = ''

  for (let i = 0; i < CASOS.length; i++) {
    const caso = CASOS[i]
    const bloque = document.createElement('div')
    bloque.className = 'caso'

    const titulo = document.createElement('h2')
    titulo.textContent = caso.titulo + '  ·  ' + caso.archivo
    bloque.appendChild(titulo)

    const par = document.createElement('div')
    par.className = 'par'
    const antes = lado('antes')
    const despues = lado('despues')
    par.appendChild(antes)
    par.appendChild(despues)
    bloque.appendChild(par)

    const informe = document.createElement('div')
    informe.className = 'informe'
    bloque.appendChild(informe)
    contenedor.appendChild(bloque)

    try {
      const contenido = await (await fetch('/templates/svg-lab/' + caso.archivo)).text()

      const original = parsear(contenido)
      if (original) antes.appendChild(original)

      const procesado = parsear(contenido)
      if (!procesado) {
        informe.textContent = 'no se pudo parsear'
        continue
      }
      despues.appendChild(procesado)

      const inicio = performance.now()
      const reporte = await SvgTextEngine.process(procesado, parametros(), {
        news: caso.noticia
          ? {
              label: '%NEWS%',
              text: '- ' + (campos['%TEXTO%'] ? campos['%TEXTO%'].value : PREDETERMINADOS['%TEXTO%']),
              speed: 60,
              loop: true,
              glassId: 'lab' + i
            }
          : undefined
      })
      const ms = Math.round((performance.now() - inicio) * 10) / 10

      informe.textContent =
        'variables: ' + reporte.substitutions +
        '   areas: ' + reporte.areas +
        '   compuestas: ' + reporte.composed +
        '   reducidas: ' + reporte.shrunk +
        '   marquesinas: ' + reporte.tickers +
        '   tiempo: ' + ms + ' ms'
    } catch (error) {
      informe.textContent = 'error: ' + (error as Error).message
    }
  }
}

function arrancar(): void {
  const mapa: Record<string, string> = {
    '%NOMBRE%': 'p-nombre',
    '%ASUNTO%': 'p-asunto',
    '%TEXTO%': 'p-texto',
    '%DETALLE%': 'p-detalle'
  }

  const etiquetas = Object.keys(mapa)
  for (let i = 0; i < etiquetas.length; i++) {
    const etiqueta = etiquetas[i]
    const campo = document.getElementById(mapa[etiqueta]) as HTMLInputElement | null
    if (!campo) continue
    campo.value = PREDETERMINADOS[etiqueta]
    campo.addEventListener('input', () => {
      void pintar()
    })
    campos[etiqueta] = campo
  }

  void pintar()
}

arrancar()
;(window as any).__svgLabPintar = pintar
