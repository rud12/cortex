import { inventoryWsUrl } from '../api/env';

class InventorySocket {
  constructor() {
    this.ws = null;
    this.listeners = [];
    this.connected = false;
    this.retryTimer = null;
    this.shouldReconnect = false;
  }

  connect() {
    this.shouldReconnect = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;

    this.ws = new WebSocket(inventoryWsUrl);

    this.ws.onopen = () => {
      this.connected = true;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.listeners.forEach((cb) => cb(data));
      } catch {

      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (this.shouldReconnect) {
        this.retryTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = () => {
      this.connected = false;
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    try {
      this.ws?.close();
    } catch {

    }
    this.ws = null;
    this.connected = false;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }
}

export default new InventorySocket();
