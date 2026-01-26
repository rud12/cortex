import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import chatRoutes from './routes/chatRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/v1/chat', chatRoutes);

app.use(errorHandler);

const sslBasePath = process.env.SSL_FILE_PATH || '../';
const keyPath = path.resolve(__dirname, sslBasePath, 'key.pem');
const certPath = path.resolve(__dirname, sslBasePath, 'cert.pem');

const sslOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

const port = process.env.PORT || 3006;
const host = process.env.HOST || '0.0.0.0';
https.createServer(sslOptions, app).listen(port, host, () => {
  console.log(`Chat service listening on ${host}:${port}`);
});
