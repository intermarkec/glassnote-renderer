/**
 * Escala de los glasses.
 *
 * El arte se disena sobre un lienzo de 1920x1080, pero la regla no es la misma en una
 * pantalla apaisada que en una vertical, porque no se usan para lo mismo.
 *
 * APAISADA. El ancho de la ventana ES el 1920 del lienzo: un arte de 1920 de ancho ocupa
 * la pantalla de borde a borde y uno de 960 ocupa la mitad, sin importar la proporcion de
 * la ventana. El arte no se toca salvo que se desborde a lo ancho, y ahi se achica lo
 * justo para que el ancho entre. El alto puede quedar afuera: lo recorta la ventana.
 *
 * VERTICAL. Se usa en moviles, donde lo que importa es que el arte se vea lo mas grande
 * posible pero nunca ampliado: crece hasta llenar la pantalla o hasta su tamano real, lo
 * que pase primero.
 *
 * Antes habia una sola regla para las dos, calculada con Math.max() de los dos ratios y
 * despues acotada con Math.min(), lo que algebraicamente daba siempre min(W/1920, H/1080).
 * En apaisado eso dejaba barras a los lados en cuanto la ventana no fuera 16:9 clavado:
 * en una de 1920x1014, que es lo que queda al descontar los paneles, el glass salia de
 * 1803 de ancho con 59 px de barra a cada lado, y encima el boton de confirmacion se iba
 * afuera del arte porque PositionManager solo lo considera "de ancho completo" a partir
 * del 95%. Y en vertical era peor, porque acotaba contra un lienzo apaisado: un arte de
 * 1080x1920 en una pantalla de 1080x1920 salia de 607x1080 en vez de entrar exacto.
 */
export class ScaleCalculator {
  private referenceWidth = 1920;
  private mobileBreakpoint = 768;

  /**
   * Cuanto vale una unidad del lienzo de 1920 en la ventana actual. La usan el boton de
   * confirmacion y el HTML para escalar sus propias medidas.
   */
  calculateScaleFactor(): number {
    return window.innerWidth / this.referenceWidth;
  }

  isMobile(): boolean {
    return window.innerWidth <= this.mobileBreakpoint;
  }

  /** La ventana es mas ancha que alta. */
  isLandscape(): boolean {
    return window.innerWidth >= window.innerHeight;
  }

  /**
   * Medidas finales de un arte dentro de la ventana.
   *
   * @param originalWidth ancho del arte en sus propias unidades
   * @param originalHeight alto del arte en sus propias unidades
   * @param scaleFactor escala de referencia; solo se devuelve si el arte no tiene medidas
   */
  calculateScaledDimensions(originalWidth: number, originalHeight: number, scaleFactor: number): {
    width: number;
    height: number;
    ratio: number
  } {
    if (originalWidth <= 0 || originalHeight <= 0) {
      return { width: 0, height: 0, ratio: scaleFactor };
    }

    const anchoVentana = window.innerWidth;
    const altoVentana = window.innerHeight;

    let ratio: number;

    if (anchoVentana >= altoVentana) {
      // Apaisada: el ancho de la ventana es el 1920 del lienzo. Un arte mas ancho que el
      // lienzo se achica lo justo para que su ancho entre; el alto se deja desbordar.
      ratio = anchoVentana / Math.max(this.referenceWidth, originalWidth);
    } else {
      // Vertical: lo mas grande que entre, sin pasar del tamano real del arte.
      ratio = Math.min(1, anchoVentana / originalWidth, altoVentana / originalHeight);
    }

    return {
      width: originalWidth * ratio,
      height: originalHeight * ratio,
      ratio: ratio
    };
  }
}
