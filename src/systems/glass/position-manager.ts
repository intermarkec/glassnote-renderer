export interface Position {
  h: number;
  v: number;
}

export interface PositionStrings {
  hOrigin: string;
  vOrigin: string;
}

export class PositionManager {
  positionElement(element: HTMLElement, position: Position): void {
    const pos = this.getPositionStrings(position);
    
    Object.assign(element.style, {
      left: pos.hOrigin,
      top: pos.vOrigin,
      transform: `translate(-50%, -50%)`
    });
  }

  getPositionStrings(position: Position): PositionStrings {
    const hPositions = ['left', 'center', 'right'];
    const vPositions = ['top', 'center', 'bottom'];
    
    const hIndex = Math.max(0, Math.min(2, position.h - 1));
    const vIndex = Math.max(0, Math.min(2, position.v - 1));
    
    const hOrigin = hPositions[hIndex];
    const vOrigin = vPositions[vIndex];
    
    return { hOrigin, vOrigin };
  }

  getPositionFromStrings(hOrigin: string, vOrigin: string): Position {
    const hPositions = ['left', 'center', 'right'];
    const vPositions = ['top', 'center', 'bottom'];
    
    const h = hPositions.indexOf(hOrigin) + 1;
    const v = vPositions.indexOf(vOrigin) + 1;
    
    return {
      h: Math.max(1, Math.min(3, h)),
      v: Math.max(1, Math.min(3, v))
    };
  }

  calculatePositionCoordinates(position: Position, elementWidth: number, elementHeight: number): { x: number; y: number } {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    let x = 0;
    let y = 0;
    
    switch (position.h) {
      case 1: // left
        x = elementWidth / 2;
        break;
      case 2: // center
        x = screenWidth / 2;
        break;
      case 3: // right
        x = screenWidth - (elementWidth / 2);
        break;
    }
    
    switch (position.v) {
      case 1: // top
        y = elementHeight / 2;
        break;
      case 2: // center
        y = screenHeight / 2;
        break;
      case 3: // bottom
        y = screenHeight - (elementHeight / 2);
        break;
    }
    
    return { x, y };
  }

  isPositionValid(position: Position): boolean {
    return position.h >= 1 && position.h <= 3 && position.v >= 1 && position.v <= 3;
  }

  getAvailablePositions(): Position[] {
    const positions: Position[] = [];
    for (let h = 1; h <= 3; h++) {
      for (let v = 1; v <= 3; v++) {
        positions.push({ h, v });
      }
    }
    return positions;
  }

  getPositionKey(position: Position): string {
    return `${position.h}:${position.v}`;
  }

  parsePositionKey(key: string): Position | null {
    const parts = key.split(':');
    if (parts.length !== 2) return null;
    
    const h = parseInt(parts[0]);
    const v = parseInt(parts[1]);
    
    if (isNaN(h) || isNaN(v) || h < 1 || h > 3 || v < 1 || v > 3) {
      return null;
    }
    
    return { h, v };
  }
}