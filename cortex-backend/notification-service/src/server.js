import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import notificationRoutes from './routes/notificationRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const sslPath = process.env.SSL_FILE_PATH || '../../';
const ssl = {
  key: fs.readFileSync(path.resolve(__dirname, sslPath, 'key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, sslPath, 'cert.pem'))
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/v1/health', (req, res) => res.json({ success: true, message: 'Notification service healthy' }));
app.use('/api/v1/notifications', notificationRoutes);
app.use(errorHandler);

const port = process.env.PORT || 3007, host = process.env.HOST || '0.0.0.0';
https.createServer(ssl, app).listen(port, host, () => console.log(`Notification service on ${host}:${port}`));
