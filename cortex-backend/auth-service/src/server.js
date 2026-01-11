import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { syncSystemRoles } from './controllers/userController.js';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sslBasePath = process.env.SSL_FILE_PATH || '../';
const sslOptions = { key: fs.readFileSync(path.resolve(__dirname, sslBasePath, 'key.pem')), cert: fs.readFileSync(path.resolve(__dirname, sslBasePath, 'cert.pem')) };

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/v1/health', (req, res) => res.json({ success: true, data: { status: 'ok' }, message: 'Auth service healthy' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use(errorHandler);

const port = process.env.PORT || 3001;
const host = process.env.HOST || '0.0.0.0';

syncSystemRoles().then(() => {
  https.createServer(sslOptions, app).listen(port, host, () => console.log(`Auth service running at https://${host}:${port}`));
}).catch((err) => {
  console.error('Failed to start auth service', err);
  process.exit(1);
});
