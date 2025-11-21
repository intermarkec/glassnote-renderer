// Glass system types and interfaces

export interface GlassPosition {
  h: number
  v: number
}

export interface GlassData {
  id: number
  messageId?: string
  position: string
  duration?: number
  transparency?: string
  askConfirmation?: boolean
  needPresent?: boolean
  isAsyncronous?: boolean
  messageType: string
  uploads?: string
  baseUrl?: string
  parameters?: string
  content?: string
}

export interface GlassMessage {
  event: string
  data: GlassData
}

export interface ActiveGlassInfo {
  id: number
  timestamp: number
}

export interface GlassProcessor {
  process(glassContent: HTMLElement, data: GlassData, upload: any): Promise<void>
}

export interface PositionStrings {
  h: string
  v: string
  hOrigin: string
  vOrigin: string
}

export interface ButtonStyles {
  left?: string
  right?: string
  top?: string
  transform?: string
}

export interface UploadItem {
  id: string
  path: string
  mimetype: string
}

export interface FormResponse {
  [key: string]: any
}