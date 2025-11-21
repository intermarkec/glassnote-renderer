export interface Transaction {
  id: string;
  createdAt?: string;
  name?: string;
  description?: string;
  messageName?: string;
  messageDescription?: string;
  messageType?: string;
  status?: string;
  position?: string;
  duration?: number;
  transparency?: string;
  needPresent?: boolean;
  askConfirmation?: boolean;
  isAsyncronous?: boolean;
  uploads?: string;
  parameters?: string;
  serverUrl?: string;
  serverName?: string;
  baseUrl?: string;
}

export interface PendingRequest {
  serverUrl: string;
  timestamp: number;
  requestId: string;
}

export interface MouseMoveButtonOptions {
  button: HTMLElement;
  clickHandler: (event: Event) => void;
  normalColor?: string;
  hoverColor?: string;
}

export interface ReviewTransaction extends Transaction {
  serverUrl: string;
  serverName: string;
  uploads: string;
  position: string;
  duration: number;
  transparency: string;
  needPresent: boolean;
  askConfirmation: boolean;
  isAsyncronous: boolean;
  parameters: string;
  baseUrl: string;
}