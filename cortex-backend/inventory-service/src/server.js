import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productRoutes from './routes/productRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initInventorySocket } from './websocket/inventorySocket.js';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sslBasePath = process.env.SSL_FILE_PATH || '../../';
const keyPath = path.resolve(__dirname, sslBasePath, 'key.pem');
const certPath = path.resolve(__dirname, sslBasePath, 'cert.pem');
const sslOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/inventory-data', express.static(path.resolve(__dirname, '../../data')));

app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: 'Inventory service healthy' });
});

app.use('/api/v1/products', productRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/settings', settingsRoutes);

app.use(errorHandler);

const port = process.env.PORT || 3002;
const host = process.env.HOST || '0.0.0.0';
const httpsServer = https.createServer(sslOptions, app);
initInventorySocket(httpsServer);
httpsServer.listen(port, host, () => {
  console.log(`Inventory service listening on ${host}:${port}`);
});
