export class ScaleCalculator {
  calculateScaleFactor(): number {
    const isMobile = this.isMobile();
    const baseWidth = 1920;
    const baseHeight = 1080;
    
    if (isMobile) {
      return this.calculateMobileScaleFactor();
    } else {
      return this.calculateDesktopScaleFactor(baseWidth, baseHeight);
    }
  }

  isMobile(): boolean {
    return window.innerWidth <= 768 || 
           window.innerHeight <= 768 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private calculateMobileScaleFactor(): number {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const baseMobileWidth = 768;
    
    let scaleFactor = Math.min(screenWidth, screenHeight) / baseMobileWidth;
    scaleFactor = Math.max(0.3, Math.min(1.5, scaleFactor));
    
    return scaleFactor;
  }

  private calculateDesktopScaleFactor(baseWidth: number, baseHeight: number): number {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    const widthRatio = screenWidth / baseWidth;
    const heightRatio = screenHeight / baseHeight;
    
    let scaleFactor = Math.min(widthRatio, heightRatio);
    scaleFactor = Math.max(0.5, Math.min(2.0, scaleFactor));
    
    return scaleFactor;
  }

  calculateScaledDimensions(width: number, height: number, scaleFactor: number): { 
    width: number; 
    height: number; 
    ratio: number 
  } {
    const scaledWidth = Math.round(width * scaleFactor);
    const scaledHeight = Math.round(height * scaleFactor);
    const ratio = scaledWidth / width;
    
    return {
      width: scaledWidth,
      height: scaledHeight,
      ratio: ratio
    };
  }
}