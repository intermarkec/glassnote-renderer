import { Transaction, PendingRequest, ReviewTransaction } from '../types';

export class ReviewView {
  private container: HTMLElement;
  private transactions: Transaction[] = [];
  private pendingRequests: PendingRequest[] = [];
  private onPlayTransaction?: (transaction: ReviewTransaction) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setTransactions(transactions: Transaction[]): void {
    this.transactions = transactions;
    this.render();
  }

  setPendingRequests(pendingRequests: PendingRequest[]): void {
    this.pendingRequests = pendingRequests;
    this.render();
  }

  setOnPlayTransaction(callback: (transaction: ReviewTransaction) => void): void {
    this.onPlayTransaction = callback;
  }

  render(): void {
    this.container.innerHTML = this.generateHTML();
    this.attachEventListeners();
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
    `;
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
        <p>Loading transactions from ${serverCount} server(s)...</p>
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