import { WebSocketServer } from 'ws';

class InventorySocket {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.clients = new Set();

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }
}

let inventorySocket = null;

export const initInventorySocket = (server) => {
  inventorySocket = new InventorySocket(server);
  return inventorySocket;
};

export const getInventorySocket = () => inventorySocket;