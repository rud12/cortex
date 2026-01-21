import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import transactionRoutes from './routes/transactionRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sslOptions = {
  key: fs.readFileSync(path.resolve(__dirname, process.env.SSL_FILE_PATH || '../../', 'key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, process.env.SSL_FILE_PATH || '../../', 'cert.pem'))
};

const app = express();
app.use(cors(), express.json({ limit: '2mb' }));
app.use('/pos-data', express.static(path.resolve(__dirname, '../../data')));

app.get('/api/v1/health', (req, res) => res.json({ success: true, data: { status: 'ok' }, message: 'POS service healthy' }));
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use(errorHandler);

const port = process.env.PORT || 3003, host = process.env.HOST || '0.0.0.0';
https.createServer(sslOptions, app).listen(port, host, () => console.log(`POS service on ${host}:${port}`));
