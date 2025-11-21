export interface Position {
  h: number;
  v: number;
}

export interface PositionStrings {
  h: string;
  v: string;
  hOrigin: string;
  vOrigin: string;
}

export interface ButtonPositionStyles {
  left?: string;
  right?: string;
  top?: string;
  transform?: string;
}

export class PositionManager {
  private hPositions: string[] = ['left', 'center', 'right'];
  private vPositions: string[] = ['top', 'center', 'bottom'];
  private origins: string[] = ['left', 'center', 'right'];
  private vOrigins: string[] = ['top', 'center', 'bottom'];

  /**
   * Convierte posición numérica a string
   * @param position - Posición con h y v numéricos
   * @returns Posición con strings
   */
  getPositionStrings(position: Position): PositionStrings {
    return {
      h: this.hPositions[position.h] || 'center',
      v: this.vPositions[position.v] || 'center',
      hOrigin: this.origins[position.h] || 'center',
      vOrigin: this.vOrigins[position.v] || 'center'
    };
  }

  /**
   * Posiciona un elemento basado en la posición especificada
   * @param element - Elemento a posicionar
   * @param position - Posición con h y v
   */
  positionElement(element: HTMLElement, position: Position): void {
    const pos = this.getPositionStrings(position);
    
    let left = '50%';
    let top = '50%';
    let transform = 'translate(-50%, -50%)';
    
    if (pos.h === 'left') {
      left = '0';
      transform = 'translate(0, -50%)';
    } else if (pos.h === 'right') {
      left = '100%';
      transform = 'translate(-100%, -50%)';
    }
    
    if (pos.v === 'top') {
      top = '0';
      transform = transform.replace('translate(-50%, -50%)', 'translate(-50%, 0)')
          .replace('translate(0, -50%)', 'translate(0, 0)')
          .replace('translate(-100%, -50%)', 'translate(-100%, 0)');
    } else if (pos.v === 'bottom') {
      top = '100%';
      transform = transform.replace('translate(-50%, -50%)', 'translate(-50%, -100%)')
          .replace('translate(0, -50%)', 'translate(0, -100%)')
          .replace('translate(-100%, -50%)', 'translate(-100%, -100%)');
    }
    
    element.style.left = left;
    element.style.top = top;
    element.style.transform = transform + ' translateZ(0)';
  }

  /**
   * Calcula la posición del botón de confirmación
   * @param glassContent - Contenido del glass
   * @param position - Posición del glass
   * @param buttonSize - Tamaño del botón
   * @param scaleFactor - Factor de escala
   * @returns Estilos de posicionamiento
   */
  calculateButtonPosition(glassContent: HTMLElement, position: Position, buttonSize: number, scaleFactor: number): ButtonPositionStyles | null {
    const glassRect = glassContent.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const baseMargin = 20;
    const baseSpacing = 10;
    const baseButtonOffset = 60;
    
    const scaledMargin = baseMargin * scaleFactor;
    const scaledSpacing = baseSpacing * scaleFactor;
    const scaledButtonOffset = baseButtonOffset * scaleFactor;

    // Si el glass no está renderizado, esperar
    if (glassRect.width === 0 || glassRect.height === 0) {
      return null;
    }

    // Verificar si el glass ocupa 95% o más del ancho de ventana
    const glassWidthPercentage = (glassRect.width / windowWidth) * 100;
    const isFullWidth = glassWidthPercentage >= 95;

    // Verificar si es dispositivo móvil
    const isMobile = window.innerWidth <= 768;

    let buttonStyles: ButtonPositionStyles = {
      left: 'auto',
      right: 'auto',
      top: 'auto',
      transform: 'none'
    };

    if (isFullWidth) {
      // Glass de ancho completo, intentar posicionar fuera de la imagen
      if (glassRect.top >= buttonSize + scaledMargin) {
        // Espacio arriba - botón arriba a la derecha
        buttonStyles.right = scaledMargin + 'px';
        buttonStyles.top = (glassRect.top - buttonSize - scaledMargin) + 'px';
      } else if (windowHeight - glassRect.bottom >= buttonSize + scaledMargin) {
        // Espacio abajo - botón abajo a la derecha
        buttonStyles.right = scaledMargin + 'px';
        buttonStyles.top = (glassRect.bottom + scaledMargin) + 'px';
      } else {
        // Sin espacio fuera, posicionar dentro arriba a la derecha
        buttonStyles.right = scaledMargin + 'px';
        buttonStyles.top = (glassRect.top + scaledMargin) + 'px';
      }
    } else {
      // Verificar overflow para glass en posición central
      const proposedRightPosition = glassRect.right + scaledSpacing;
      const proposedLeftPosition = glassRect.left - scaledButtonOffset;
      
      // Detectar si hay overflow horizontal
      const wouldOverflowRight = proposedRightPosition + buttonSize > windowWidth - scaledMargin;
      const wouldOverflowLeft = proposedLeftPosition < scaledMargin;
      
      // En móvil, usar márgenes más grandes y posicionamiento más conservador
      const mobileMargin = isMobile ? scaledMargin * 1.5 : scaledMargin;
      
      // Posicionar botón adyacente al contenido del glass
      if (position.h === 0) {
        // Glass a la izquierda, botón a la derecha
        if (wouldOverflowRight || isMobile) {
          // Si overflow a la derecha o es móvil, mover arriba o abajo
          if (glassRect.top >= buttonSize + mobileMargin) {
            buttonStyles.right = mobileMargin + 'px';
            buttonStyles.top = (glassRect.top - buttonSize - mobileMargin) + 'px';
          } else if (windowHeight - glassRect.bottom >= buttonSize + mobileMargin) {
            buttonStyles.right = mobileMargin + 'px';
            buttonStyles.top = (glassRect.bottom + mobileMargin) + 'px';
          } else {
            // Sin espacio, posicionar dentro arriba a la derecha
            buttonStyles.right = mobileMargin + 'px';
            buttonStyles.top = (glassRect.top + mobileMargin) + 'px';
          }
        } else {
          buttonStyles.left = proposedRightPosition + 'px';
          buttonStyles.top = (glassRect.top + scaledSpacing) + 'px';
        }
      } else if (position.h === 2) {
        // Glass a la derecha, botón a la izquierda
        if (wouldOverflowLeft || isMobile) {
          // Si overflow a la izquierda o es móvil, mover arriba o abajo
          if (glassRect.top >= buttonSize + mobileMargin) {
            buttonStyles.left = mobileMargin + 'px';
            buttonStyles.top = (glassRect.top - buttonSize - mobileMargin) + 'px';
          } else if (windowHeight - glassRect.bottom >= buttonSize + mobileMargin) {
            buttonStyles.left = mobileMargin + 'px';
            buttonStyles.top = (glassRect.bottom + mobileMargin) + 'px';
          } else {
            // Sin espacio, posicionar dentro arriba a la izquierda
            buttonStyles.left = mobileMargin + 'px';
            buttonStyles.top = (glassRect.top + mobileMargin) + 'px';
          }
        } else {
          buttonStyles.left = proposedLeftPosition + 'px';
          buttonStyles.top = (glassRect.top + scaledSpacing) + 'px';
        }
      } else {
        // Glass en centro, verificar overflow
        if (wouldOverflowRight || isMobile) {
          // Si overflow a la derecha o es móvil, mover arriba o abajo
          if (glassRect.top >= buttonSize + mobileMargin) {
            buttonStyles.right = mobileMargin + 'px';
            buttonStyles.top = (glassRect.top - buttonSize - mobileMargin) + 'px';
          } else if (windowHeight - glassRect.bottom >= buttonSize + mobileMargin) {
            buttonStyles.right = mobileMargin + 'px';
            buttonStyles.top = (glassRect.bottom + mobileMargin) + 'px';
          } else {
            // Sin espacio, posicionar dentro arriba a la derecha
            buttonStyles.right = mobileMargin + 'px';
            buttonStyles.top = (glassRect.top + mobileMargin) + 'px';
          }
        } else {
          buttonStyles.left = proposedRightPosition + 'px';
          buttonStyles.top = (glassRect.top + scaledSpacing) + 'px';
        }
      }
    }

    return buttonStyles;
  }

  getPositionKey(position: Position): string {
    return `${position.h}:${position.v}`;
  }

  parsePositionKey(key: string): Position | null {
    const parts = key.split(':');
    if (parts.length !== 2) return null;
    
    const h = parseInt(parts[0]);
    const v = parseInt(parts[1]);
    
    if (isNaN(h) || isNaN(v) || h < 0 || h > 2 || v < 0 || v > 2) {
      return null;
    }
    
    return { h, v };
  }
}