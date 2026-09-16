// Videos de YouTube dentro de un glass HTML.
//
// El editor de plantillas ya tiene un elemento YouTube y lo guarda como
//
//   <div id="youtube001" style="position:absolute; left:…%; …">
//     <iframe src="https://www.youtube.com/embed/ID" style="width:100%; height:100%; …"></iframe>
//   </div>
//
// y en el equipo no se veia: la CSP del iframe del glass no dejaba cargar ningun frame
// externo. Abrirla no alcanza, por tres cosas que se midieron sobre Electron 29:
//
// 1. Un glass no se toca (sin class="form" los clics pasan al escritorio), asi que un
//    video que no arranca solo no arranca nunca. El src del editor no trae autoplay.
// 2. YouTube rechaza el embed sin Referer con "Video player configuration error" (el 153).
//    El cliente carga el renderer desde file:// y de ahi Chromium no manda Referer: eso lo
//    pone el proceso principal del cliente (main.js), no se puede desde aca. La
//    previsualizacion web se sirve por https y lo manda sola. Lo que si hay que evitar es
//    que la plantilla lo apague con referrerpolicy="no-referrer".
// 3. Un link de "compartir" (watch?v=, youtu.be/) no se puede embeber: YouTube lo sirve con
//    X-Frame-Options y el iframe queda en blanco. Se pasa a /embed/.

/** Los unicos origenes externos que el iframe del glass deja embeber. */
export const YOUTUBE_FRAME_ORIGINS = ['https://www.youtube.com', 'https://www.youtube-nocookie.com']

/** Lo que tiene que dejar hacer el iframe del video; se suma a lo que ya traiga. */
const REQUIRED_ALLOW = ['autoplay', 'encrypted-media', 'picture-in-picture']

// Los ids de YouTube son 11 caracteres de este alfabeto.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

export interface YoutubeVideo {
  /** El id de 11 caracteres. */
  id: string
  /** El src con el que queda el iframe. */
  src: string
}

interface ParsedYoutubeUrl {
  id: string
  nocookie: boolean
  params: URLSearchParams
}

/**
 * Lee cualquier forma de URL de un video: embed, watch, youtu.be, shorts y live, con o sin
 * www/m, y el dominio sin cookies. null si no es un video de YouTube.
 */
export function parseYoutubeUrl(raw: string | null): ParsedYoutubeUrl | null {
  if (!raw) return null
  let url: URL
  try {
    // La base solo resuelve el "//www.youtube.com/…" sin protocolo. Es un dominio que no
    // existe para que una ruta relativa ("logo.svg") no pase por YouTube.
    url = new URL(raw.trim(), 'https://glass.invalid')
  } catch (error) {
    return null
  }

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '')
  const path = url.pathname.split('/').filter(Boolean)
  let id: string | null = null
  // Los parametros de un embed son del reproductor y se respetan. Los de un link de
  // compartir son de la pagina (si=, feature=, pp=) y no significan nada en un embed.
  const params = new URLSearchParams()

  if (host === 'youtu.be') {
    id = path[0] || null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (path[0] === 'embed' || path[0] === 'shorts' || path[0] === 'live') {
      id = path[1] || null
      if (path[0] === 'embed') url.searchParams.forEach((value, key) => params.set(key, value))
    } else if (path[0] === 'watch') {
      id = url.searchParams.get('v')
    }
  } else {
    return null
  }

  if (!id || !VIDEO_ID.test(id)) return null

  if (path[0] !== 'embed') {
    const start = parseStartTime(url.searchParams.get('t') || url.searchParams.get('start'))
    if (start > 0) params.set('start', String(start))
    const list = url.searchParams.get('list')
    if (list) params.set('list', list)
  }

  return { id, nocookie: host === 'youtube-nocookie.com', params }
}

/** El t= de un link de compartir: "90", "90s" o "1m30s". */
function parseStartTime(raw: string | null): number {
  if (!raw) return 0
  if (/^\d+$/.test(raw)) return parseInt(raw, 10)
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!match) return 0
  return (parseInt(match[1] || '0', 10) * 3600) + (parseInt(match[2] || '0', 10) * 60) + parseInt(match[3] || '0', 10)
}

/**
 * El src de embed con el que se dibuja. Lo que la plantilla ya haya pedido gana, salvo el
 * sonido en la previsualizacion.
 */
export function buildEmbedSrc(parsed: ParsedYoutubeUrl, muted: boolean): string {
  const params = new URLSearchParams(parsed.params)
  if (!params.has('autoplay')) params.set('autoplay', '1')
  if (!params.has('playsinline')) params.set('playsinline', '1')
  if (!params.has('rel')) params.set('rel', '0')
  // loop=1 solo repite si la lista es el mismo video: sin playlist= termina y se queda en
  // la pantalla final, sin error ni aviso.
  if (params.get('loop') === '1' && !params.has('playlist')) params.set('playlist', parsed.id)
  // La previsualizacion del panel no suena (2.2.3), y un navegador ademas no deja arrancar
  // con sonido un video que nadie toco: lo dejaria en pausa.
  if (muted) params.set('mute', '1')

  const host = parsed.nocookie ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com'
  return `${host}/embed/${parsed.id}?${params.toString()}`
}

/**
 * Deja listos los iframes de YouTube de una plantilla ya parseada. Los demas iframes no se
 * tocan. Devuelve los videos que encontro, para el log.
 */
export function prepareYoutubeFrames(container: ParentNode, options: { muted: boolean }): YoutubeVideo[] {
  const videos: YoutubeVideo[] = []

  container.querySelectorAll('iframe').forEach((iframe) => {
    const parsed = parseYoutubeUrl(iframe.getAttribute('src'))
    if (!parsed) return

    const src = buildEmbedSrc(parsed, options.muted)
    iframe.setAttribute('src', src)

    const allow = (iframe.getAttribute('allow') || '')
      .split(';')
      .map((token) => token.trim())
      .filter(Boolean)
    for (const feature of REQUIRED_ALLOW) {
      if (!allow.some((token) => token.split(/\s+/)[0] === feature)) allow.push(feature)
    }
    iframe.setAttribute('allow', allow.join('; '))
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')

    videos.push({ id: parsed.id, src })
  })

  return videos
}
