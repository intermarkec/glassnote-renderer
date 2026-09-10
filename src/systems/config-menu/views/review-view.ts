import { Transaction, PendingRequest, ReviewTransaction } from '../types';

export class ReviewView {
  private container: HTMLElement;
  private transactions: Transaction[] = [];
  private pendingRequests: PendingRequest[] = [];
  private onPlayTransaction?: (transaction: ReviewTransaction) => void;
  private onLoadMore?: () => void;
  private hayMas: boolean = false;
  private cargandoMas: boolean = false;
  // Donde estaba el scroll antes de volver a dibujar. Sin esto, cada tanda nueva te
  // devuelve al principio de la lista, que es justo de donde venias bajando.
  private scrollGuardado: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setTransactions(transactions: Transaction[]): void {
    this.transactions = transactions;
    this.render();
  }

  /**
   * Si quedan mas glasses para traer. Lo dice el servidor; mientras sea true la lista
   * sigue pidiendo al llegar al final del scroll.
   */
  setHayMas(hayMas: boolean): void {
    this.hayMas = hayMas;
    this.cargandoMas = false;
    this.render();
  }

  setOnLoadMore(callback: () => void): void {
    this.onLoadMore = callback;
  }

  setPendingRequests(pendingRequests: PendingRequest[]): void {
    this.pendingRequests = pendingRequests;
    this.render();
  }

  setOnPlayTransaction(callback: (transaction: ReviewTransaction) => void): void {
    this.onPlayTransaction = callback;
  }

  render(): void {
    const lista = this.container.querySelector('.transactions-scroll');
    if (lista) this.scrollGuardado = lista.scrollTop;
    this.container.innerHTML = this.generateHTML();
    this.attachEventListeners();
    const nueva = this.container.querySelector('.transactions-scroll') as HTMLElement | null;
    if (nueva && this.scrollGuardado) nueva.scrollTop = this.scrollGuardado;
  }

  private generateHTML(): string {
    if (this.transactions.length === 0 && this.pendingRequests.length === 0) {
      return `
        <div class="empty-state">
          No hay transacciones o solicitudes pendientes para revisar.
        </div>
      `;
    }

    return `
      <div class="review-section">
        <h2 class="review-title">Ultimos glasses recibidos</h2>
        ${this.generateTransactionsTable()}
        ${this.generatePendingRequestsHTML()}
      </div>
    `;
  }

  private generateTransactionsTable(): string {
    if (this.transactions.length === 0) {
      return '<p class="no-data">No transactions found</p>';
    }

    const tableRows = this.transactions.map((transaction, index) => {
      const date = this.formatDate(transaction.createdAt || '');
      // Use serverName if available, otherwise extract from uploads
      const name = transaction.name || transaction.serverName || this.extractNameFromUploads(transaction.uploads || '') || 'N/A';
      const description = transaction.description || this.extractDescriptionFromUploads(transaction.uploads || '') || 'N/A';
      
      return `
        <tr class="neumorphic-table-cell">
          <td class="date-cell">${date.replace(/\n/g, '<br>')}</td>
          <td class="name-cell">${name}</td>
          <td class="desc-cell">${description}</td>
          <td class="action-cell">
            <button class="play-button" data-index="${index}">Play</button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="transactions-scroll">
        <table class="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        ${this.generatePieDeLista()}
      </div>
    `;
  }

  private generatePieDeLista(): string {
    if (this.cargandoMas) {
      return '<div class="lista-pie">Cargando mas...</div>';
    }
    if (this.hayMas) {
      return '<div class="lista-pie">Segui bajando para ver mas</div>';
    }
    return '<div class="lista-pie lista-pie-final">No hay mas glasses</div>';
  }

  private generatePendingRequestsHTML(): string {
    if (this.pendingRequests.length === 0) {
      return '';
    }

    const requestsHTML = this.pendingRequests.map(request => `
      <div class="review-item">
        <div class="review-item-header">
          <h3 class="review-item-title">Solicitud Pendiente</h3>
          <span class="review-item-status status-pending">
            Pendiente
          </span>
        </div>
        <p class="review-item-details">
          <strong>ID:</strong> ${request.requestId}<br>
          <strong>Servidor:</strong> ${request.serverUrl}<br>
          <strong>Fecha:</strong> ${new Date(request.timestamp).toLocaleString()}
        </p>
      </div>
    `).join('');

    return requestsHTML;
  }

  private attachEventListeners(): void {
    // Carga al llegar al final: se pide la tanda siguiente un poco ANTES del borde, para
    // que la lista no se corte mientras baja.
    const lista = this.container.querySelector('.transactions-scroll') as HTMLElement | null;
    if (lista) {
      lista.addEventListener('scroll', () => {
        // Al redibujar, el contenedor viejo se reemplaza pero su listener sigue vivo y
        // puede recibir un scroll que quedo en camino. Ya fuera del documento mide todo
        // 0, o sea "estoy al final", y pediria una tanda de mas por cada redibujado.
        if (!lista.isConnected) return;
        if (!this.hayMas || this.cargandoMas || !this.onLoadMore) return;
        const faltaParaElFinal = lista.scrollHeight - lista.scrollTop - lista.clientHeight;
        if (faltaParaElFinal > 60) return;
        this.cargandoMas = true;
        this.render();
        this.onLoadMore();
      });
    }

    const playButtons = this.container.querySelectorAll('.play-button');
    playButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const index = parseInt(target.dataset.index || '0');
        const transaction = this.transactions[index] as ReviewTransaction;
        if (this.onPlayTransaction && transaction) {
          this.onPlayTransaction(transaction);
        }
      });
    });
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      const today = new Date();
      
      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
      } else {
        const datePart = date.toLocaleDateString();
        const timePart = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        return datePart + '\n' + timePart;
      }
    } catch (e) {
      return dateString;
    }
  }

  private extractNameFromUploads(uploadsString: string): string {
    try {
      const uploads = JSON.parse(uploadsString);
      if (uploads && uploads.length > 0) {
        return uploads[0].filename || 'Transaction';
      }
    } catch (e) {
    }
    return 'Transaction';
  }

  private extractDescriptionFromUploads(uploadsString: string): string {
    try {
      const uploads = JSON.parse(uploadsString);
      if (uploads && uploads.length > 0) {
        return uploads[0].description || 'No description';
      }
    } catch (e) {
    }
    return 'No description';
  }

  // These methods are kept for compatibility but not currently used
  // private getStatusClass(status: string): string {
  //   switch (status) {
  //     case 'completed':
  //       return 'status-completed';
  //     case 'failed':
  //       return 'status-failed';
  //     case 'pending':
  //     default:
  //       return 'status-pending';
  //   }
  // }

  // private getStatusText(status: string): string {
  //   switch (status) {
  //     case 'completed':
  //       return 'Completado';
  //     case 'failed':
  //       return 'Fallido';
  //     case 'pending':
  //     default:
  //       return 'Pendiente';
  //   }
  // }

  showLoading(): void {
    this.container.innerHTML = `
      <div class="loading-state">
        <h2 class="review-title">Ultimos glasses recibidos</h2>
        <p>Loading transactions...</p>
      </div>
    `;
  }

  showLoadingWithServers(serverCount: number): void {
    this.container.innerHTML = `
      <div class="loading-state">
        <h2 class="review-title">Ultimos glasses recibidos</h2>
        <p>Cargando mensajes: ${serverCount} servers conectados...</p>
      </div>
    `;
  }

  showNoConnections(): void {
    this.container.innerHTML = `
      <div class="error-state">
        <h2 class="review-title">Ultimos glasses recibidos</h2>
        <p>No estas conectado</p>
      </div>
    `;
  }

  showError(message: string): void {
    this.container.innerHTML = `
      <div class="error-state">
        Error al cargar los datos: ${message}
      </div>
    `;
  }
}