// Basic Glass system implementation for TypeScript + Vue migration

// Simple Glass class to provide basic functionality
class Glass {
  private url: string | null
  private message: any
  private element: HTMLElement | null = null

  constructor(url: string | null, message: any) {
    this.url = url
    this.message = message
    this.initialize()
  }

  private initialize(): void {
    // Create a basic glass element
    this.element = document.createElement('div')
    this.element.style.position = 'fixed'
    this.element.style.top = '0'
    this.element.style.left = '0'
    this.element.style.width = '100%'
    this.element.style.height = '100%'
    this.element.style.zIndex = '1000'
    this.element.style.pointerEvents = 'none'
    this.element.style.display = 'flex'
    this.element.style.justifyContent = 'center'
    this.element.style.alignItems = 'center'

    // Add content based on message type
    this.renderContent()

    // Add to glass container
    const container = document.getElementById('glass-container')
    if (container) {
      container.appendChild(this.element)
    }

    // Set up auto-removal if duration is specified
    if (this.message.data.duration) {
      setTimeout(() => {
        this.destroy()
      }, this.message.data.duration * 1000)
    }
  }

  private renderContent(): void {
    if (!this.element) return

    const data = this.message.data

    switch (data.messageType) {
      case 'html':
        this.renderHTML(data)
        break
      case 'image':
        this.renderImage(data)
        break
      case 'news':
        this.renderNews(data)
        break
      case 'form':
        this.renderForm(data)
        break
      default:
        this.renderDefault(data)
    }
  }

  private renderHTML(data: any): void {
    if (!this.element) return

    try {
      const parameters = JSON.parse(data.parameters || '[]')
      const htmlParam = parameters.find((p: any) => p.label === 'html')
      
      if (htmlParam && htmlParam.value) {
        this.element.innerHTML = htmlParam.value
          .replace('%VERSION%', window.rendererVersion || '1.0.0')
      }
    } catch (error) {
      console.error('Error rendering HTML glass:', error)
      this.renderDefault(data)
    }
  }

  private renderImage(data: any): void {
    if (!this.element) return

    const img = document.createElement('img')
    img.src = data.baseUrl + data.uploads
    img.style.maxWidth = '90%'
    img.style.maxHeight = '90%'
    img.style.objectFit = 'contain'
    
    this.element.appendChild(img)
  }

  private renderNews(data: any): void {
    if (!this.element) return

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
    
    this.element.appendChild(newsDiv)
  }

  private renderForm(data: any): void {
    if (!this.element) return

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
    
    this.element.appendChild(formDiv)
  }

  private renderDefault(data: any): void {
    if (!this.element) return

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
    
    this.element.appendChild(defaultDiv)
  }

  public destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
    
    // Remove from unified queue if applicable
    if (this.message.data.messageId && window.removeFromUnifiedQueue) {
      window.removeFromUnifiedQueue(this.message.data.messageId)
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