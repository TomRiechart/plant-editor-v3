import { Router } from 'express';
import { getDb, generateId } from '../db.js';

const router = Router();

// Get all settings
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT key, value FROM app_settings').all();
    
    // Convert array to object
    const settingsObject: Record<string, string> = {};
    for (const setting of settings as any[]) {
      settingsObject[setting.key] = setting.value;
    }

    res.json({ success: true, data: settingsObject });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// Get single setting
router.get('/:key', (req, res) => {
  try {
    const db = getDb();
    const { key } = req.params;
    const setting = db.prepare('SELECT key, value FROM app_settings WHERE key = ?').get(key) as any;
    
    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    res.json({ success: true, data: { [setting.key]: setting.value } });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch setting' });
  }
});

// Update setting
router.put('/:key', (req, res) => {
  try {
    const db = getDb();
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }

    // Check if setting exists
    const existing = db.prepare('SELECT id FROM app_settings WHERE key = ?').get(key);
    
    if (existing) {
      db.prepare(`
        UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?
      `).run(value, key);
    } else {
      db.prepare(`
        INSERT INTO app_settings (id, key, value) VALUES (?, ?, ?)
      `).run(generateId(), key, value);
    }

    res.json({ success: true, data: { [key]: value } });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ success: false, error: 'Failed to update setting' });
  }
});

// Bulk update settings
router.put('/', (req, res) => {
  try {
    const db = getDb();
    const settings = req.body;

    if (typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Body must be an object' });
    }

    const upsert = db.prepare(`
      INSERT INTO app_settings (id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        upsert.run(generateId(), key, value);
      }
    });

    transaction();

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

export default router;
