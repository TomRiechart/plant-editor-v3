import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const collectionsDir = path.join(uploadsDir, 'collections');
const plantsDir = path.join(uploadsDir, 'plants');
const dbPath = path.join(dataDir, 'plant-editor.db');

// Ensure directories exist
function ensureDirectories() {
  for (const dir of [dataDir, uploadsDir, collectionsDir, plantsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    ensureDirectories();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const db = getDb();

  // Create tables
  db.exec(`
    -- Collections table
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      thumbnail_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Collection images table
    CREATE TABLE IF NOT EXISTS collection_images (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      is_main INTEGER DEFAULT 0,
      name TEXT,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    );

    -- Plants table
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      thumbnail_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- App settings table
    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_collection_images_collection ON collection_images(collection_id);
    CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
  `);

  // Insert default settings if not exist
  const defaultSettings = [
    {
      key: 'system_prompt',
      value: `You are an expert image-generation engine. Your task is to modify the provided image by replacing specific plants.

CRITICAL RULES:
1. Replace ONLY the plants inside the marked circles
2. Keep the original pots exactly as they are
3. Maintain the same lighting, shadows, and perspective
4. The new plant should look natural in the environment
5. Do not change any other elements in the image`,
    },
    {
      key: 'implement_prompt_analyze',
      value: `Analyze the differences between these two images (before and after editing).
Focus on:
1. Which plant(s) were replaced
2. What the new plant(s) look like
3. The position and size of the changes
4. Any style or lighting adjustments

Provide a detailed description that will help replicate this edit on similar images.`,
    },
    {
      key: 'implement_prompt_generate',
      value: `Based on this analysis of changes:
{analysis}

And looking at the target image, generate a specific editing prompt that will apply similar changes to this new image.
Consider:
1. The position of plants in this specific image
2. How to maintain consistency with the reference edit
3. Any adjustments needed for this specific scene

Output ONLY the editing prompt, no explanations.`,
    },
    {
      key: 'implement_prompt_apply',
      value: `Apply the following changes to the image:
{customPrompt}

Maintain the original lighting and atmosphere. Keep all pots and non-plant elements unchanged.`,
    },
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO app_settings (id, key, value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);

  for (const setting of defaultSettings) {
    insertSetting.run(crypto.randomUUID(), setting.key, setting.value);
  }

  console.log('📊 Database tables created');
}

// Helper functions
export function generateId(): string {
  return crypto.randomUUID();
}

export function getUploadPath(type: 'collections' | 'plants', filename: string): string {
  return path.join(type === 'collections' ? collectionsDir : plantsDir, filename);
}

export function getUploadUrl(type: 'collections' | 'plants', filename: string): string {
  return `/uploads/${type}/${filename}`;
}
