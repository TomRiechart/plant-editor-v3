import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import collectionsRouter from './routes/collections.js';
import plantsRouter from './routes/plants.js';
import settingsRouter from './routes/settings.js';
import generateRouter from './routes/generate.js';
import implementRouter from './routes/implement.js';
import { initDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
const dataDir = path.join(__dirname, '..', 'data');
app.use('/uploads', express.static(path.join(dataDir, 'uploads')));

// API Routes
app.use('/api/collections', collectionsRouter);
app.use('/api/plants', plantsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/generate', generateRouter);
app.use('/api/implement', implementRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    console.log('✅ Database initialized');

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📁 Uploads served from: ${path.join(dataDir, 'uploads')}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
