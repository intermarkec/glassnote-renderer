import { ScaleCalculator } from './scale-calculator';
import { FileLoader } from './file-loader';

interface GlassInstance {
  // Interface mínima requerida por ImageProcessor
}

export class ImageProcessor {
  private glass: GlassInstance;
  private scaleCalculator: ScaleCalculator;

  constructor(glassInstance: GlassInstance) {
    this.glass = glassInstance;
    this.scaleCalculator = new ScaleCalculator();
  }

  async process(glassContent: HTMLElement, data: any, upload: any): Promise<void> {
    const self = this;
    const imageUrl = data.baseUrl + upload.path;
    
    return FileLoader.loadImage(imageUrl)
      .then(function(loadedImg: HTMLImageElement) {
        return self._createImageElement(glassContent, loadedImg, data);
      })
      .catch(function(imgError: Error) {
        console.error('Error loading image:', imgError);
        
        if (self._isCorsOrCspError(imgError)) {
          console.warn('CORS/CSP issue detected with image loading.');
        }
        
        throw imgError;
      });
  }

  private _createImageElement(glassContent: HTMLElement, loadedImg: HTMLImageElement, data: any): Promise<void> {
    const imgElement = document.createElement('img');
    imgElement.src = loadedImg.src;
    imgElement.style.display = 'block';
    imgElement.style.transform = 'translateZ(0)';

    const originalWidth = loadedImg.naturalWidth;
    const originalHeight = loadedImg.naturalHeight;
    const scaleFactor = this.scaleCalculator.calculateScaleFactor();
    
    const dimensions = this.scaleCalculator.calculateScaledDimensions(
      originalWidth, 
      originalHeight, 
      scaleFactor
    );

    const applyDimensions = function() {
      const imgRect = imgElement.getBoundingClientRect();
      if (imgRect.width === 0 || imgRect.height === 0) {
        requestAnimationFrame(applyDimensions);
        return;
      }

      imgElement.style.width = dimensions.width + 'px';
      imgElement.style.height = dimensions.height + 'px';
    };

    requestAnimationFrame(applyDimensions);
    glassContent.appendChild(imgElement);
    
    return Promise.resolve();
  }

  private _isCorsOrCspError(error: Error): boolean {
    if (!error.message) return false;
    
    return error.message.includes('CORS') ||
           error.message.includes('cross-origin') ||
           error.message.includes('Content Security Policy') ||
           error.message.includes('CSP');
  }
}

window.ImageProcessor = ImageProcessor;