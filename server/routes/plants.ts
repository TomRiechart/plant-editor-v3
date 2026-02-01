import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDb, generateId, getUploadPath, getUploadUrl } from '../db.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'plants');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${generateId()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Get all plants
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const plants = db.prepare('SELECT * FROM plants ORDER BY created_at DESC').all();
    res.json({ success: true, data: plants });
  } catch (error) {
    console.error('Error fetching plants:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plants' });
  }
});

// Get single plant
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);
    
    if (!plant) {
      return res.status(404).json({ success: false, error: 'Plant not found' });
    }

    res.json({ success: true, data: plant });
  } catch (error) {
    console.error('Error fetching plant:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plant' });
  }
});

// Create plant with image upload
router.post('/', upload.single('image'), (req, res) => {
  try {
    const db = getDb();
    const { name } = req.body;
    const file = req.file;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    if (!file) {
      return res.status(400).json({ success: false, error: 'Image is required' });
    }

    const id = generateId();
    const imageUrl = getUploadUrl('plants', file.filename);

    db.prepare(`
      INSERT INTO plants (id, name, image_url, thumbnail_url)
      VALUES (?, ?, ?, ?)
    `).run(id, name, imageUrl, imageUrl); // Using same URL for thumbnail for now

    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);

    res.json({ success: true, data: plant });
  } catch (error) {
    console.error('Error creating plant:', error);
    res.status(500).json({ success: false, error: 'Failed to create plant' });
  }
});

// Update plant
router.put('/:id', upload.single('image'), (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name } = req.body;
    const file = req.file;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (file) {
      // Delete old image
      const oldPlant = db.prepare('SELECT image_url FROM plants WHERE id = ?').get(id) as any;
      if (oldPlant?.image_url) {
        const oldFilename = oldPlant.image_url.replace('/uploads/plants/', '');
        const oldFilepath = getUploadPath('plants', oldFilename);
        if (fs.existsSync(oldFilepath)) {
          fs.unlinkSync(oldFilepath);
        }
      }

      const imageUrl = getUploadUrl('plants', file.filename);
      updates.push('image_url = ?', 'thumbnail_url = ?');
      values.push(imageUrl, imageUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    values.push(id);
    db.prepare(`UPDATE plants SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id);
    res.json({ success: true, data: plant });
  } catch (error) {
    console.error('Error updating plant:', error);
    res.status(500).json({ success: false, error: 'Failed to update plant' });
  }
});

// Delete plant
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Get plant to delete file
    const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id) as any;
    if (!plant) {
      return res.status(404).json({ success: false, error: 'Plant not found' });
    }

    // Delete image file
    const filename = plant.image_url.replace('/uploads/plants/', '');
    const filepath = getUploadPath('plants', filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Delete from database
    db.prepare('DELETE FROM plants WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting plant:', error);
    res.status(500).json({ success: false, error: 'Failed to delete plant' });
  }
});

export default router;
