import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/db.js';
import apiRoutes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { attachRtc } from './rtc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'client', 'dist');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = (
  process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || LOOPBACK_ORIGIN.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'youtube', time: new Date().toISOString() });
});

app.use('/api', apiRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found.', code: 'NOT_FOUND' });
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      message: 'YouTube API is running.',
      hint: 'Start the Vite client with npm run dev:client or build with npm run build.'
    });
  });
}

app.use((error, _req, res, _next) => {
  if (error?.name === 'ValidationError') {
    return res.status(400).json({
      message: Object.values(error.errors).map((entry) => entry.message).join(' '),
      code: 'VALIDATION_ERROR'
    });
  }
  if (error?.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier.', code: 'INVALID_ID' });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ message: 'That record already exists.', code: 'DUPLICATE' });
  }
  if (error?.message === 'Origin is not allowed by CORS.') {
    return res.status(403).json({ message: error.message, code: 'CORS_DENIED' });
  }

  console.error(error);
  return res.status(500).json({
    message: 'Something went wrong on the server. Please try again.',
    code: 'INTERNAL_ERROR'
  });
});

const port = Number(process.env.PORT) || 5000;

async function start() {
  try {
    await connectDatabase();
    console.log('MongoDB connected');
    const server = app.listen(port, () => {
      console.log(`YouTube API listening on http://localhost:${port}`);
    });
    const detachRtc = attachRtc(server);
    server.on('close', detachRtc);
    return server;
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
