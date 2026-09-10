/**
 * Las tipografías que pide el arte de un mensaje, bajadas SOLO cuando alguna las necesita.
 *
 * Por qué así y no empaquetadas en el renderer: el renderer se lo baja entero cada equipo
 * en cada versión, así que una fuente ahí le cuesta a todo el parque aunque sus mensajes
 * no la usen nunca. Servidas por la API, cada equipo baja únicamente la que su arte pide y
 * el navegador se la queda cacheada entre versiones.
 *
 * La fuente de la marca es la excepción y sigue embebida (`src/fonts/kinetika.css`): el
 * splash sale antes de que haya un servidor con el que hablar.
 */

interface FuenteDelCatalogo {
  familias: string[];
  archivo: string;
  peso: number;
  estilo: string;
}

const catalogos = new Map<string, Promise<FuenteDelCatalogo[]>>();
const bajadas = new Map<string, Promise<string | null>>();

/**
 * De dónde salen las fuentes. El mensaje trae `baseUrl` apuntando a los uploads
 * (`…/public`); las fuentes cuelgan de la raíz del mismo servidor.
 */
export function origenDeFuentes(baseUrl: string | undefined | null): string | null {
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl, window.location.href).origin + '/fonts';
  } catch {
    return null;
  }
}

/** Las familias que menciona un SVG o un HTML, sin repetir. */
export function familiasQuePide(contenido: string): string[] {
  const familias = new Set<string>();
  const patrones = [
    // Las comillas NO se excluyen del valor: `font-family:'Kinetika-Medium'` es lo que
    // escribe Illustrator dentro del <style> del SVG, y dejándolas fuera la captura salía
    // vacía y esa familia no se bajaba nunca. Se limpian después, por separado.
    /font-family\s*:\s*([^;}<\n]+)/gi,
    /font-family\s*=\s*"([^"]+)"/gi,
    /font-family\s*=\s*'([^']+)'/gi,
  ];
  for (const patron of patrones) {
    let encontrado: RegExpExecArray | null;
    while ((encontrado = patron.exec(contenido)) !== null) {
      // Una declaración puede traer varias, separadas por coma, y con comillas.
      for (const suelta of encontrado[1].split(',')) {
        // Se corta en la primera comilla que cierre: dentro de un atributo
        // `style="font-family: X, serif"` la captura se lleva puesto el resto de la
        // etiqueta, y quedaba una familia fantasma tipo `serif">hola`.
        const limpia = suelta.trim().replace(/^['"]/, '').replace(/['">].*$/, '').trim();
        // Las genéricas no se bajan de ningún lado.
        if (!limpia || /^(serif|sans-serif|monospace|cursive|fantasy|inherit|initial)$/i.test(limpia)) continue;
        familias.add(limpia);
      }
    }
  }
  return [...familias];
}

async function catalogoDe(origen: string): Promise<FuenteDelCatalogo[]> {
  if (!catalogos.has(origen)) {
    catalogos.set(
      origen,
      fetch(`${origen}/fonts.json`)
        .then((r) => (r.ok ? r.json() : { fuentes: [] }))
        .then((d) => (Array.isArray(d?.fuentes) ? d.fuentes : []))
        .catch(() => []),
    );
  }
  return catalogos.get(origen)!;
}

/**
 * Se asegura de que las familias pedidas estén disponibles y devuelve el CSS con las
 * fuentes EN BASE64, que es lo que hace falta para los mensajes html: se dibujan en un
 * iframe, y un iframe no hereda las @font-face del padre ni puede salir a buscar la
 * fuente —su CSP sólo admite `self`, `data:` y `blob:`—.
 */
export async function asegurarFuentes(familias: string[], origen: string | null): Promise<string> {
  if (!origen || familias.length === 0) return '';
  const catalogo = await catalogoDe(origen);
  if (catalogo.length === 0) return '';

  const css: string[] = [];
  await Promise.all(
    familias.map(async (familia) => {
      const entrada = catalogo.find((f) =>
        f.familias.some((n) => n.toLowerCase() === familia.toLowerCase()),
      );
      if (!entrada) return;
      const reglas = await bajarFuente(origen, entrada);
      if (reglas) css.push(reglas);
    }),
  );
  return css.join('\n');
}

async function bajarFuente(origen: string, entrada: FuenteDelCatalogo): Promise<string | null> {
  const clave = `${origen}|${entrada.archivo}`;
  if (!bajadas.has(clave)) {
    bajadas.set(
      clave,
      (async () => {
        try {
          const respuesta = await fetch(`${origen}/${entrada.archivo}`);
          if (!respuesta.ok) return null;
          const datos = await respuesta.arrayBuffer();

          // En el documento principal la fuente se agrega como binario: así no pasa por
          // el CSS y no hay CSP que la pueda bloquear. Ahí viven los SVG, que se inyectan
          // inline.
          for (const familia of entrada.familias) {
            const fuente = new FontFace(familia, datos, {
              weight: String(entrada.peso),
              style: entrada.estilo,
            });
            document.fonts.add(await fuente.load());
          }

          // Y en base64 para poder metérsela a los iframes de los mensajes html.
          const base64 = btoa(String.fromCharCode(...new Uint8Array(datos)));
          return entrada.familias
            .map(
              (familia) => `@font-face{font-family:'${familia}';src:url(data:font/woff2;base64,${base64}) format('woff2');font-weight:${entrada.peso};font-style:${entrada.estilo};font-display:block;}`,
            )
            .join('\n');
        } catch (error) {
          console.warn('No se pudo bajar la fuente', entrada.archivo, error);
          return null;
        }
      })(),
    );
  }
  return bajadas.get(clave)!;
}
