export class ScaleCalculator {
  private referenceWidth = 1920;
  private referenceHeight = 1080;
  private mobileBreakpoint = 768;

  calculateScaleFactor(): number {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;

    const widthRatio = currentWidth / this.referenceWidth;
    const heightRatio = currentHeight / this.referenceHeight;

    // Para dispositivos móviles, usar un enfoque diferente
    const isMobile = currentWidth <= this.mobileBreakpoint;
    
    if (isMobile) {
      // En móviles, usar un escalado más conservador
      // Usar el ratio mínimo para que quepa el contenido, pero limitarlo
      return Math.min(Math.max(widthRatio, heightRatio), 1.2);
    }

    // Utilizar el mayor de los dos ratios para que quepa en la pantalla
    return Math.max(widthRatio, heightRatio);
  }

  isMobile(): boolean {
    return window.innerWidth <= this.mobileBreakpoint;
  }

  calculateScaledDimensions(originalWidth: number, originalHeight: number, scaleFactor: number): {
    width: number;
    height: number;
    ratio: number
  } {
    const scaledWidth = originalWidth * scaleFactor;
    const scaledHeight = originalHeight * scaleFactor;
    
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;

    const widthRatio = maxWidth / scaledWidth;
    const heightRatio = maxHeight / scaledHeight;
    const ratio = Math.min(1, widthRatio, heightRatio);

    return {
      width: scaledWidth * ratio,
      height: scaledHeight * ratio,
      ratio: ratio
    };
  }
}