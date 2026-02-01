import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDbPath = path.join(__dirname, 'test.db');

let db: Database.Database;

beforeAll(() => {
  // Create test database
  db = new Database(testDbPath);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      thumbnail_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      thumbnail_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
});

afterAll(() => {
  db.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  // Also remove WAL files
  const walPath = testDbPath + '-wal';
  const shmPath = testDbPath + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
});

beforeEach(() => {
  // Clean tables
  db.exec('DELETE FROM collection_images');
  db.exec('DELETE FROM collections');
  db.exec('DELETE FROM plants');
  db.exec('DELETE FROM app_settings');
});

describe('Collections Table', () => {
  it('should create a collection', () => {
    const result = db.prepare(
      'INSERT INTO collections (id, name) VALUES (?, ?)'
    ).run('col-1', 'Test Collection');
    
    expect(result.changes).toBe(1);
  });

  it('should read a collection by ID', () => {
    db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)').run('col-1', 'Test');
    
    const row = db.prepare('SELECT * FROM collections WHERE id = ?').get('col-1') as any;
    
    expect(row).toBeDefined();
    expect(row.name).toBe('Test');
  });

  it('should update a collection', () => {
    db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)').run('col-1', 'Original');
    db.prepare('UPDATE collections SET name = ? WHERE id = ?').run('Updated', 'col-1');
    
    const row = db.prepare('SELECT name FROM collections WHERE id = ?').get('col-1') as any;
    expect(row.name).toBe('Updated');
  });

  it('should delete a collection', () => {
    db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)').run('col-1', 'Test');
    db.prepare('DELETE FROM collections WHERE id = ?').run('col-1');
    
    const row = db.prepare('SELECT * FROM collections WHERE id = ?').get('col-1');
    expect(row).toBeUndefined();
  });

  it('should list all collections', () => {
    db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)').run('col-1', 'First');
    db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)').run('col-2', 'Second');
    db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)').run('col-3', 'Third');
    
    const rows = db.prepare('SELECT * FROM collections').all();
    expect(rows).toHaveLength(3);
  });
});

describe('Plants Table', () => {
  it('should create a plant', () => {
    const result = db.prepare(
      'INSERT INTO plants (id, name, image_url) VALUES (?, ?, ?)'
    ).run('plant-1', 'Monstera', '/monstera.jpg');
    
    expect(result.changes).toBe(1);
  });

  it('should read a plant by ID', () => {
    db.prepare('INSERT INTO plants (id, name, image_url) VALUES (?, ?, ?)')
      .run('plant-1', 'Ficus', '/ficus.jpg');
    
    const row = db.prepare('SELECT * FROM plants WHERE id = ?').get('plant-1') as any;
    
    expect(row.name).toBe('Ficus');
    expect(row.image_url).toBe('/ficus.jpg');
  });

  it('should update a plant', () => {
    db.prepare('INSERT INTO plants (id, name, image_url) VALUES (?, ?, ?)')
      .run('plant-1', 'Old', '/old.jpg');
    db.prepare('UPDATE plants SET name = ?, image_url = ? WHERE id = ?')
      .run('New', '/new.jpg', 'plant-1');
    
    const row = db.prepare('SELECT * FROM plants WHERE id = ?').get('plant-1') as any;
    expect(row.name).toBe('New');
    expect(row.image_url).toBe('/new.jpg');
  });

  it('should delete a plant', () => {
    db.prepare('INSERT INTO plants (id, name, image_url) VALUES (?, ?, ?)')
      .run('plant-1', 'Test', '/test.jpg');
    db.prepare('DELETE FROM plants WHERE id = ?').run('plant-1');
    
    const row = db.prepare('SELECT * FROM plants WHERE id = ?').get('plant-1');
    expect(row).toBeUndefined();
  });

  it('should list all plants', () => {
    db.prepare('INSERT INTO plants (id, name, image_url) VALUES (?, ?, ?)')
      .run('p1', 'A', '/a.jpg');
    db.prepare('INSERT INTO plants (id, name, image_url) VALUES (?, ?, ?)')
      .run('p2', 'B', '/b.jpg');
    
    const rows = db.prepare('SELECT * FROM plants').all();
    expect(rows).toHaveLength(2);
  });
});

describe('Collection Images Table', () => {
  beforeEach(() => {
    // Create a collection first
    db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)').run('col-1', 'Test');
  });

  it('should add an image to a collection', () => {
    const result = db.prepare(
      'INSERT INTO collection_images (id, collection_id, image_url, name) VALUES (?, ?, ?, ?)'
    ).run('img-1', 'col-1', '/image.jpg', 'Test Image');
    
    expect(result.changes).toBe(1);
  });

  it('should set main image', () => {
    db.prepare('INSERT INTO collection_images (id, collection_id, image_url, is_main) VALUES (?, ?, ?, ?)')
      .run('img-1', 'col-1', '/1.jpg', 0);
    db.prepare('INSERT INTO collection_images (id, collection_id, image_url, is_main) VALUES (?, ?, ?, ?)')
      .run('img-2', 'col-1', '/2.jpg', 1);
    
    const main = db.prepare(
      'SELECT * FROM collection_images WHERE collection_id = ? AND is_main = 1'
    ).get('col-1') as any;
    
    expect(main.id).toBe('img-2');
  });

  it('should get images by collection', () => {
    db.prepare('INSERT INTO collection_images (id, collection_id, image_url) VALUES (?, ?, ?)')
      .run('img-1', 'col-1', '/1.jpg');
    db.prepare('INSERT INTO collection_images (id, collection_id, image_url) VALUES (?, ?, ?)')
      .run('img-2', 'col-1', '/2.jpg');
    
    const images = db.prepare(
      'SELECT * FROM collection_images WHERE collection_id = ?'
    ).all('col-1');
    
    expect(images).toHaveLength(2);
  });

  it('should respect order_index', () => {
    db.prepare('INSERT INTO collection_images (id, collection_id, image_url, order_index) VALUES (?, ?, ?, ?)')
      .run('img-1', 'col-1', '/1.jpg', 2);
    db.prepare('INSERT INTO collection_images (id, collection_id, image_url, order_index) VALUES (?, ?, ?, ?)')
      .run('img-2', 'col-1', '/2.jpg', 0);
    db.prepare('INSERT INTO collection_images (id, collection_id, image_url, order_index) VALUES (?, ?, ?, ?)')
      .run('img-3', 'col-1', '/3.jpg', 1);
    
    const images = db.prepare(
      'SELECT * FROM collection_images WHERE collection_id = ? ORDER BY order_index ASC'
    ).all('col-1') as any[];
    
    expect(images[0].id).toBe('img-2');
    expect(images[1].id).toBe('img-3');
    expect(images[2].id).toBe('img-1');
  });
});

describe('App Settings Table', () => {
  it('should store a setting', () => {
    db.prepare('INSERT INTO app_settings (id, key, value) VALUES (?, ?, ?)')
      .run('s1', 'theme', 'dark');
    
    const setting = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('theme') as any;
    expect(setting.value).toBe('dark');
  });

  it('should update a setting', () => {
    db.prepare('INSERT INTO app_settings (id, key, value) VALUES (?, ?, ?)')
      .run('s1', 'theme', 'light');
    db.prepare('UPDATE app_settings SET value = ? WHERE key = ?')
      .run('dark', 'theme');
    
    const setting = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('theme') as any;
    expect(setting.value).toBe('dark');
  });

  it('should enforce unique keys', () => {
    db.prepare('INSERT INTO app_settings (id, key, value) VALUES (?, ?, ?)')
      .run('s1', 'unique_key', 'value1');
    
    expect(() => {
      db.prepare('INSERT INTO app_settings (id, key, value) VALUES (?, ?, ?)')
        .run('s2', 'unique_key', 'value2');
    }).toThrow();
  });

  it('should store long text values', () => {
    const longPrompt = 'A'.repeat(5000);
    db.prepare('INSERT INTO app_settings (id, key, value) VALUES (?, ?, ?)')
      .run('s1', 'prompt', longPrompt);
    
    const setting = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('prompt') as any;
    expect(setting.value.length).toBe(5000);
  });
});

describe('Foreign Key Constraints', () => {
  it('should cascade delete images when collection is deleted', () => {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)').run('col-1', 'Test');
    db.prepare('INSERT INTO collection_images (id, collection_id, image_url) VALUES (?, ?, ?)')
      .run('img-1', 'col-1', '/1.jpg');
    db.prepare('INSERT INTO collection_images (id, collection_id, image_url) VALUES (?, ?, ?)')
      .run('img-2', 'col-1', '/2.jpg');
    
    // Delete collection
    db.prepare('DELETE FROM collections WHERE id = ?').run('col-1');
    
    // Images should be deleted
    const images = db.prepare('SELECT * FROM collection_images WHERE collection_id = ?').all('col-1');
    expect(images).toHaveLength(0);
  });
});
