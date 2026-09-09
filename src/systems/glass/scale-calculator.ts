/**
 * Escala de los glasses.
 *
 * El arte se disena siempre sobre un lienzo de 1920x1080. La ventana casi nunca tiene
 * esa proporcion: en Linux el overlay va al area util y no a la pantalla entera, asi que
 * los paneles le comen alto (medido en un escritorio tipico: 1920x1014, 66 px de
 * paneles), y en cualquier monitor que no sea 16:9 pasa lo mismo por el otro lado.
 *
 * La regla es que **el ajuste se hace en vertical, no en horizontal**: el arte apaisado
 * ocupa siempre todo el ancho de la ventana y lo que sobra o falta se resuelve en el
 * alto. El arte vertical hace lo contrario, ocupa todo el alto, porque si llenara el
 * ancho se recortaria casi entero.
 *
 * Antes se calculaba con Math.max() y despues se volvia a acotar con Math.min(), lo que
 * algebraicamente daba siempre min(W/1920, H/1080): el arte entraba completo pero dejaba
 * barras. En una ventana de 1920x1014 el glass salia de 1803 de ancho, con 59 px de
 * barra a cada lado, y encima el boton de confirmacion se iba afuera del arte porque
 * PositionManager solo lo considera "de ancho completo" a partir del 95%.
 */
export class ScaleCalculator {
  private referenceWidth = 1920;
  private mobileBreakpoint = 768;

  /**
   * Cuanto se agranda o achica el lienzo de referencia para llenar el ancho de la
   * ventana. Lo usan tambien el boton de confirmacion y el HTML para escalar sus
   * medidas, asi que sale del ancho y no de una mezcla de los dos ejes.
   */
  calculateScaleFactor(): number {
    const currentWidth = window.innerWidth;
    return currentWidth / this.referenceWidth;
  }

  isMobile(): boolean {
    return window.innerWidth <= this.mobileBreakpoint;
  }

  /**
   * Medidas finales de un arte dentro de la ventana.
   *
   * Apaisado llena el ancho; vertical llena el alto. En el eje que queda, el arte se
   * sale o deja hueco, y de eso se encarga el recorte de la ventana.
   *
   * @param originalWidth ancho del arte en sus propias unidades
   * @param originalHeight alto del arte en sus propias unidades
   * @param scaleFactor escala de referencia; se respeta salvo que el arte sea vertical,
   *                    en cuyo caso manda el alto de la ventana
   */
  calculateScaledDimensions(originalWidth: number, originalHeight: number, scaleFactor: number): {
    width: number;
    height: number;
    ratio: number
  } {
    if (originalWidth <= 0 || originalHeight <= 0) {
      return { width: 0, height: 0, ratio: scaleFactor };
    }

    const maxHeight = window.innerHeight;
    const esApaisado = originalWidth >= originalHeight;

    let ratio = scaleFactor;

    if (!esApaisado) {
      // El arte vertical se ajusta por alto. Si se lo hiciera llenar el ancho, en una
      // pantalla apaisada quedaria varias veces mas alto que la ventana.
      const alto = originalHeight * ratio;
      if (alto > maxHeight) ratio = maxHeight / originalHeight;
    }

    return {
      width: originalWidth * ratio,
      height: originalHeight * ratio,
      ratio: ratio
    };
  }
}
