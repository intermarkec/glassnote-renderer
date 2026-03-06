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
    
    // Check if this is actually an image URL before trying to load it
    const lowerUrl = imageUrl.toLowerCase();
    if (lowerUrl.endsWith('.html') || lowerUrl.endsWith('.htm')) {
      // Try to fall back to HTML processing if possible
      if (data.messageType === 'html' || data.messageType === 'form' || 
          upload.mimetype === 'text/html' || upload.path.toLowerCase().endsWith('.html')) {
        // We can't switch processors here, so we need to throw a more specific error
        throw new Error('HTML content sent to ImageProcessor. Check _getContentProcessor logic.');
      }
      
      throw new Error('URL appears to be HTML, not an image: ' + imageUrl);
    }
    
    return FileLoader.loadImage(imageUrl)
      .then(function(loadedImg: HTMLImageElement) {
        return self._createImageElement(glassContent, loadedImg, data);
      })
      .catch(function(imgError: Error) {
        console.error('Error loading image:', imgError);
        
        if (self._isCorsOrCspError(imgError)) {
          console.warn('CORS/CSP issue detected with image loading.');
        }
        
        return Promise.resolve();
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