// Basic Glass system implementation for TypeScript + Vue migration

// Glass class implementation compatible with review transactions
class Glass {
  private url: string | null
  private message: any
  private element: HTMLElement | null = null
  private durationTimeout: NodeJS.Timeout | null = null
  private positionKey: string | null = null

  constructor(url: string | null, message: any) {
    this.url = url
    this.message = message
    this.handleGlassDisplay()
  }

  private handleGlassDisplay(): void {
    try {
      const data = this.message.data
      const position = JSON.parse(data.position || '{"h":1,"v":1}')
      this.positionKey = position.h + ':' + position.v
      
      this.registerGlassPosition()
      this.displayGlass()
    } catch (error) {
      console.error('Error handling glass display:', error)
      this.cleanup()
    }
  }

  private registerGlassPosition(): void {
    if (window.activeGlasses && this.positionKey) {
      window.activeGlasses.set(this.positionKey, {
        id: this.message.data.id,
        timestamp: Date.now(),
      })
    }
  }

  private displayGlass(): void {
    // Play glass sound if available
    if (typeof window.playGlassSound === 'function') {
      window.playGlassSound()
    }

    this.initialize()
  }

  private initialize(): void {
    // Create main container
    this.element = document.createElement('div')
    this.element.style.position = 'fixed'
    this.element.style.left = '0'
    this.element.style.top = '0'
    this.element.style.width = '100%'
    this.element.style.height = '100%'
    this.element.style.pointerEvents = 'none'
    this.element.style.overflow = 'hidden'
    this.element.style.zIndex = '10000'

    // Create glass content with fade animation
    const glassContent = this.createGlassContent()
    
    // Setup positioning
    this.setupPositioning(glassContent)
    
    // Add content based on message type
    this.renderContent(glassContent)

    // Add to DOM
    this.element.appendChild(glassContent)
    document.body.appendChild(this.element)

    // Start fade in animation
    this.startFadeIn(glassContent)

    // Set up auto-removal if duration is specified
    if (this.message.data.duration) {
      this.durationTimeout = setTimeout(() => {
        this.finishGlass()
      }, this.message.data.duration * 1000)
    }
  }

  private createGlassContent(): HTMLElement {
    const glassContent = document.createElement('div')
    glassContent.className = 'glass-content'
    
    Object.assign(glassContent.style, {
      position: 'absolute',
      opacity: '0',
      transition: 'opacity 1s ease-in-out',
      willChange: 'transform, opacity',
      transform: 'translateZ(0)',
      zIndex: '10001'
    })

    return glassContent
  }

  private setupPositioning(glassContent: HTMLElement): void {
    try {
      const position = JSON.parse(this.message.data.position || '{"h":1,"v":1}')
      
      // Basic positioning implementation
      const positionMap = {
        '0': { h: 'left', v: 'top' },
        '1': { h: 'center', v: 'center' },
        '2': { h: 'right', v: 'bottom' }
      }
      
      const hPos = positionMap[position.h as keyof typeof positionMap] || positionMap[1]
      const vPos = positionMap[position.v as keyof typeof positionMap] || positionMap[1]
      
      glassContent.style.left = hPos.h === 'left' ? '0' : hPos.h === 'right' ? 'auto' : '50%'
      glassContent.style.right = hPos.h === 'right' ? '0' : 'auto'
      glassContent.style.top = vPos.v === 'top' ? '0' : vPos.v === 'bottom' ? 'auto' : '50%'
      glassContent.style.bottom = vPos.v === 'bottom' ? '0' : 'auto'
      glassContent.style.transform = hPos.h === 'center' || vPos.v === 'center' ? 'translate(-50%, -50%)' : 'none'
      glassContent.style.transformOrigin = hPos.h + ' ' + vPos.v
      
    } catch (error) {
      console.error('Error setting up positioning:', error)
      // Fallback to center positioning
      glassContent.style.left = '50%'
      glassContent.style.top = '50%'
      glassContent.style.transform = 'translate(-50%, -50%)'
      glassContent.style.transformOrigin = 'center center'
    }
  }

  private startFadeIn(glassContent: HTMLElement): void {
    const startFadeIn = () => {
      const contentRect = glassContent.getBoundingClientRect()
      if (contentRect.width > 0 && contentRect.height > 0) {
        glassContent.style.opacity = this.message.data.transparency || '1'
      } else {
        requestAnimationFrame(startFadeIn)
      }
    }

    setTimeout(() => {
      requestAnimationFrame(startFadeIn)
    }, 50)
  }

  private renderContent(glassContent: HTMLElement): void {
    const data = this.message.data

    switch (data.messageType) {
      case 'html':
        this.renderHTML(glassContent, data)
        break
      case 'image':
        this.renderImage(glassContent, data)
        break
      case 'news':
        this.renderNews(glassContent, data)
        break
      case 'form':
        this.renderForm(glassContent, data)
        break
      default:
        this.renderDefault(glassContent, data)
    }
  }

  private renderHTML(glassContent: HTMLElement, data: any): void {
    try {
      const parameters = JSON.parse(data.parameters || '[]')
      const htmlParam = parameters.find((p: any) => p.label === 'html')
      
      if (htmlParam && htmlParam.value) {
        glassContent.innerHTML = htmlParam.value
          .replace('%VERSION%', window.rendererVersion || '1.0.0')
      }
    } catch (error) {
      console.error('Error rendering HTML glass:', error)
      this.renderDefault(glassContent, data)
    }
  }

  private renderImage(glassContent: HTMLElement, data: any): void {
    try {
      // Parse uploads JSON to get the actual file path
      const uploads = JSON.parse(data.uploads || '[]')
      if (uploads && uploads.length > 0) {
        const upload = uploads[0]
        const img = document.createElement('img')
        img.src = data.baseUrl + upload.path
        img.style.maxWidth = '90%'
        img.style.maxHeight = '90%'
        img.style.objectFit = 'contain'
        
        glassContent.appendChild(img)
      } else {
        console.error('No uploads found in transaction data')
        this.renderDefault(glassContent, data)
      }
    } catch (error) {
      console.error('Error rendering image glass:', error)
      this.renderDefault(glassContent, data)
    }
  }

  private renderNews(glassContent: HTMLElement, data: any): void {
    const newsDiv = document.createElement('div')
    newsDiv.style.background = 'rgba(0, 0, 0, 0.8)'
    newsDiv.style.color = 'white'
    newsDiv.style.padding = '20px'
    newsDiv.style.borderRadius = '10px'
    newsDiv.style.maxWidth = '80%'
    newsDiv.style.maxHeight = '80%'
    newsDiv.style.overflow = 'auto'
    newsDiv.style.textAlign = 'center'
    
    newsDiv.textContent = data.content || 'News content'
    
    glassContent.appendChild(newsDiv)
  }

  private renderForm(glassContent: HTMLElement, data: any): void {
    const formDiv = document.createElement('div')
    formDiv.style.background = 'rgba(0, 0, 0, 0.8)'
    formDiv.style.color = 'white'
    formDiv.style.padding = '20px'
    formDiv.style.borderRadius = '10px'
    formDiv.style.maxWidth = '80%'
    formDiv.style.maxHeight = '80%'
    formDiv.style.overflow = 'auto'
    
    formDiv.innerHTML = `
      <h3>Form</h3>
      <p>Form functionality would be implemented here</p>
    `
    
    glassContent.appendChild(formDiv)
  }

  private renderDefault(glassContent: HTMLElement, data: any): void {
    const defaultDiv = document.createElement('div')
    defaultDiv.style.background = 'rgba(0, 0, 0, 0.8)'
    defaultDiv.style.color = 'white'
    defaultDiv.style.padding = '20px'
    defaultDiv.style.borderRadius = '10px'
    defaultDiv.style.textAlign = 'center'
    
    defaultDiv.innerHTML = `
      <h3>Glass Message</h3>
      <p>Type: ${data.messageType}</p>
      <p>ID: ${data.id}</p>
    `
    
    glassContent.appendChild(defaultDiv)
  }

  private finishGlass(): void {
    if (!this.element) return
    
    const glassContent = this.element.querySelector('.glass-content') as HTMLElement
    if (glassContent) {
      // Start fade out animation
      glassContent.style.opacity = '0'
      
      // Wait for fade out to complete before cleanup
      setTimeout(() => {
        this.cleanup()
      }, 1000)
    } else {
      this.cleanup()
    }
  }

  public destroy(): void {
    this.finishGlass()
  }

  private cleanup(): void {
    // Remove from unified queue when glass finishes displaying
    if (window.removeFromUnifiedQueue && this.message && this.message.data) {
      if (this.message.data.messageId) {
        window.removeFromUnifiedQueue(this.message.data.messageId)
      } else if (this.message.data.id) {
        window.removeFromUnifiedQueue(this.message.data.id.toString())
      }
    }

    // Cancel duration timeout
    if (this.durationTimeout) {
      clearTimeout(this.durationTimeout)
      this.durationTimeout = null
    }

    // Clean up active position
    if (this.positionKey && window.activeGlasses) {
      window.activeGlasses.delete(this.positionKey)
    }

    // Remove element from DOM
    if (this.element && this.element.parentNode) {
      document.body.removeChild(this.element)
    }

    // Reset state
    this.element = null
    this.positionKey = null

    // Check window visibility
    if (typeof window.checkWindowVisibility === 'function') {
      window.checkWindowVisibility()
    }
  }
}

// FileLoader implementation for package version loading
class FileLoader {
  static async loadPackageVersion(): Promise<string> {
    try {
      // In a real implementation, this would load from package.json
      // For now, return a default version
      return '1.0.0'
    } catch (error) {
      console.error('Failed to load package version:', error)
      throw error
    }
  }
}

// Sound system for playing glass sounds
class SoundSystem {
  static playQueueSound(): void {
    // In a real implementation, this would play the queue sound
    console.log('Queue sound would play here')
  }

  static playGlassSound(): void {
    // In a real implementation, this would play the glass sound
    console.log('Glass sound would play here')
  }
}

// Initialize global variables
window.activeGlasses = window.activeGlasses || new Map()

// Make classes globally available
window.Glass = Glass as any
;(window as any).FileLoader = FileLoader
window.playQueueSound = SoundSystem.playQueueSound

// Duplicate message detection
window.isDuplicateMessage = function(messageId: string, position: string): boolean {
  // Simple duplicate detection - check if same messageId is already in queue
  if (!window.unifiedGlassQueue) return false
  
  return window.unifiedGlassQueue.some((item: any) => 
    item.message.data.messageId === messageId
  )
}

// Window visibility checking
window.checkWindowVisibility = function(): void {
  // Simple implementation - in Electron this would show/hide the window
  console.log('Window visibility check')
}

// Export for use in other modules
export { Glass, FileLoader, SoundSystem }