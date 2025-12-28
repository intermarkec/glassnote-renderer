export const configMenuStyles = `
.config-menu {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  font-family: Arial, sans-serif;
}

.config-menu-container {
  background: #e0e5ec;
  border-radius: 20px;
  padding: 30px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: none;
  position: relative;
  border: 1px solid #d1d9e6;
}

.config-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #d1d9e6;
}

.config-menu-title {
  font-size: 24px;
  font-weight: bold;
  color: #5a5590;
  margin: 0;
}

.close-button {
  background: #e0e5ec;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 2px 2px 4px #b8bec7, -2px -2px 4px #ffffff;
  transition: all 0.2s ease;
  font-size: 20px;
  color: #5a5590;
}

.close-button:hover {
  transform: scale(1.1);
  box-shadow: 1px 1px 2px #b8bec7, -1px -1px 2px #ffffff;
}

.close-button:active {
  box-shadow: inset 1px 1px 2px #b8bec7, inset -1px -1px 2px #ffffff;
}

.config-menu-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.view-button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  background: #e0e5ec;
  color: #5a5590;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 2px 2px 4px #b8bec7, -2px -2px 4px #ffffff;
}

.view-button.active {
  box-shadow: inset 1px 1px 2px #5a5590, inset -1px -1px 2px #9c97c2;
  color: #ffffff;
  background: linear-gradient(145deg, #5a5590, #7a75b0);
}

.view-button:hover:not(.active) {
  transform: translateY(-2px);
  box-shadow: 3px 3px 6px #b8bec7, -3px -3px 6px #ffffff;
}

.view-content {
  background: #f0f3f7;
  border-radius: 15px;
  padding: 20px;
  box-shadow: inset 1px 1px 3px #b8bec7, inset -1px -1px 3px #ffffff;
}

.review-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.review-item {
  background: #e0e5ec;
  border-radius: 10px;
  padding: 15px;
  box-shadow: 2px 2px 4px #b8bec7, -2px -2px 4px #ffffff;
}

.review-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.review-item-title {
  font-weight: bold;
  color: #5a5590;
  margin: 0;
}

.review-item-status {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: bold;
}

.status-pending {
  background: #ffeb3b;
  color: #333;
}

.status-completed {
  background: #4caf50;
  color: white;
}

.status-failed {
  background: #f44336;
  color: white;
}

.review-item-details {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.config-title {
  color: #333;
  margin-bottom: 30px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
}

.config-buttons {
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
}

.config-button {
  padding: 15px 30px;
  background-color: #e0e5ec;
  color: #5a6c8d;
  border: none;
  border-radius: 15px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  min-width: 220px;
  box-shadow: 8px 8px 16px #b8bec7, -8px -8px 16px #ffffff;
  transition: all 0.2s cubic-bezier(.25,.8,.25,1);
}

.config-button:hover {
  background-color: #e0e5ec;
  color: #7b76b9;
  box-shadow: 4px 4px 8px #b8bec7, -4px -4px 8px #ffffff;
  transform: translateY(1px);
}

.config-button:active {
  box-shadow: inset 4px 4px 8px #b8bec7, inset -4px -4px 8px #ffffff;
  transform: translateY(2px);
}

.config-group {
  background: #e0e5ec;
  border-radius: 10px;
  padding: 15px;
  box-shadow: 2px 2px 4px #b8bec7, -2px -2px 4px #ffffff;
}

.config-group-title {
  font-weight: bold;
  color: #5a5590;
  margin: 0 0 10px 0;
  font-size: 16px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.config-label {
  color: #333;
  font-size: 14px;
}

.config-value {
  color: #5a5590;
  font-weight: bold;
  font-size: 14px;
}

.config-input,
.config-select,
.config-textarea {
  background: #f0f3f7;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: #333;
  box-shadow: inset 1px 1px 2px #b8bec7, inset -1px -1px 2px #ffffff;
  transition: all 0.2s ease;
  width: 200px;
}

.config-input:focus,
.config-select:focus,
.config-textarea:focus {
  outline: none;
  box-shadow: inset 1px 1px 2px #5a5590, inset -1px -1px 2px #9c97c2;
}

.config-textarea {
  width: 100%;
  min-height: 80px;
  resize: vertical;
}

.config-checkbox {
  width: 18px;
  height: 18px;
  accent-color: #5a5590;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 0;
}

.config-label {
  color: #333;
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}

.config-input,
.config-select,
.config-textarea {
  flex: 0 0 auto;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.action-button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 12px;
  background: #e0e5ec;
  color: #5a5590;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 2px 2px 4px #b8bec7, -2px -2px 4px #ffffff;
}

.action-button:hover {
  transform: translateY(-2px);
  box-shadow: 3px 3px 6px #b8bec7, -3px -3px 6px #ffffff;
}

.action-button:active {
  box-shadow: inset 2px 2px 4px #b8bec7, inset -2px -2px 4px #ffffff;
}

.action-button.primary {
  background: linear-gradient(145deg, #5a5590, #7a75b0);
  color: white;
}

.action-button.danger {
  background: linear-gradient(145deg, #f44336, #ff7961);
  color: white;
}

.empty-state {
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 40px 20px;
}

.loading-state {
  text-align: center;
  color: #5a5590;
  padding: 40px 20px;
}

.error-state {
  text-align: center;
  color: #f44336;
  padding: 40px 20px;
  background: #ffebee;
  border-radius: 10px;
  margin: 10px 0;
}

@media (max-width: 768px) {
  .config-menu-container {
    width: 95%;
    padding: 20px;
  }
  
  .view-buttons {
    flex-direction: column;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .config-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .config-input,
  .config-select,
  .config-textarea {
    width: 100%;
  }
}

/* Review View Table Styles */
.review-title {
  color: #333;
  margin-bottom: 20px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
}

.transactions-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 8px;
  color: #5a6c8d;
  font-size: 14px;
  border-radius: 12px;
  overflow: hidden;
  background-color: #e0e5ec;
  box-shadow: 4px 4px 8px #b8bec7, -4px -4px 8px #ffffff;
}

.transactions-table th {
  padding: 15px 12px;
  border-bottom: 2px solid rgba(184, 190, 199, 0.3);
  text-align: left;
  background-color: #e0e5ec;
  font-weight: 600;
  color: #5a6c8d;
  box-shadow: inset 2px 2px 4px #b8bec7, inset -2px -2px 4px #ffffff;
}

.transactions-table td {
  padding: 12px 10px;
  background-color: #e0e5ec;
  border-radius: 10px;
  box-shadow: 2px 2px 6px #b8bec7, -2px -2px 6px #ffffff;
}

.date-cell {
  font-size: 12px;
  color: #7a8ba6;
  white-space: pre-line;
}

.name-cell {
  color: #5a6c8d;
  font-weight: 500;
}

.desc-cell {
  color: #7a8ba6;
}

.action-cell {
  text-align: center;
}

.play-button {
  padding: 8px 16px;
  background-color: #7b76b9;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: all 0.2s ease;
}

.play-button:hover {
  background-color: #6a659f;
  transform: translateY(-1px);
}

.play-button:active {
  transform: translateY(0);
}

.no-data {
  color: rgba(0, 0, 0, 0.7);
  text-align: center;
  padding: 20px;
}
`;