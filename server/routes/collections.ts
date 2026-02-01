import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDb, generateId, getUploadPath, getUploadUrl } from '../db.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'collections');
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

// Get all collections with their images
router.get('/', (req, res) => {
  try {
    const db = getDb();
    
    const collections = db.prepare(`
      SELECT * FROM collections ORDER BY created_at DESC
    `).all();

    const images = db.prepare(`
      SELECT * FROM collection_images ORDER BY order_index ASC
    `).all();

    // Group images by collection
    const result = collections.map((collection: any) => {
      const collectionImages = images.filter((img: any) => img.collection_id === collection.id);
      const mainImage = collectionImages.find((img: any) => img.is_main);
      const linkedImages = collectionImages.filter((img: any) => !img.is_main);

      return {
        ...collection,
        images: collectionImages,
        mainImage: mainImage || null,
        linkedImages,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch collections' });
  }
});

// Get single collection
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    const images = db.prepare(`
      SELECT * FROM collection_images WHERE collection_id = ? ORDER BY order_index ASC
    `).all(id);

    const mainImage = images.find((img: any) => img.is_main);
    const linkedImages = images.filter((img: any) => !img.is_main);

    res.json({
      success: true,
      data: {
        ...collection,
        images,
        mainImage: mainImage || null,
        linkedImages,
      },
    });
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch collection' });
  }
});

// Create collection
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const id = generateId();
    db.prepare(`
      INSERT INTO collections (id, name) VALUES (?, ?)
    `).run(id, name);

    const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);

    res.json({
      success: true,
      data: {
        ...collection,
        images: [],
        mainImage: null,
        linkedImages: [],
      },
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({ success: false, error: 'Failed to create collection' });
  }
});

// Update collection
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, thumbnail_url } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (thumbnail_url !== undefined) {
      updates.push('thumbnail_url = ?');
      values.push(thumbnail_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    values.push(id);
    db.prepare(`UPDATE collections SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
    res.json({ success: true, data: collection });
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({ success: false, error: 'Failed to update collection' });
  }
});

// Delete collection
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Get all images to delete files
    const images = db.prepare('SELECT * FROM collection_images WHERE collection_id = ?').all(id);
    
    // Delete image files
    for (const img of images as any[]) {
      const filename = img.image_url.replace('/uploads/collections/', '');
      const filepath = getUploadPath('collections', filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    // Delete from database (cascade will delete images)
    db.prepare('DELETE FROM collections WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ success: false, error: 'Failed to delete collection' });
  }
});

// Add images to collection
router.post('/:id/images', upload.array('images', 10), (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Get current max order_index
    const maxOrder = db.prepare(`
      SELECT MAX(order_index) as max FROM collection_images WHERE collection_id = ?
    `).get(id) as any;
    let orderIndex = (maxOrder?.max || 0) + 1;

    // Check if collection has any images
    const existingCount = db.prepare(`
      SELECT COUNT(*) as count FROM collection_images WHERE collection_id = ?
    `).get(id) as any;
    const isFirstImage = existingCount.count === 0;

    const insertImage = db.prepare(`
      INSERT INTO collection_images (id, collection_id, image_url, is_main, name, order_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const addedImages: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageId = generateId();
      const imageUrl = getUploadUrl('collections', file.filename);
      const isMain = isFirstImage && i === 0 ? 1 : 0;
      const name = path.parse(file.originalname).name;

      insertImage.run(imageId, id, imageUrl, isMain, name, orderIndex++);

      addedImages.push({
        id: imageId,
        collection_id: id,
        image_url: imageUrl,
        is_main: Boolean(isMain),
        name,
        order_index: orderIndex - 1,
      });

      // Update collection thumbnail if this is the main image
      if (isMain) {
        db.prepare('UPDATE collections SET thumbnail_url = ? WHERE id = ?').run(imageUrl, id);
      }
    }

    res.json({ success: true, data: addedImages });
  } catch (error) {
    console.error('Error adding images:', error);
    res.status(500).json({ success: false, error: 'Failed to add images' });
  }
});

// Set main image
router.put('/:collectionId/images/:imageId/main', (req, res) => {
  try {
    const db = getDb();
    const { collectionId, imageId } = req.params;

    // Unset all main flags
    db.prepare('UPDATE collection_images SET is_main = 0 WHERE collection_id = ?').run(collectionId);

    // Set new main
    db.prepare('UPDATE collection_images SET is_main = 1 WHERE id = ?').run(imageId);

    // Update collection thumbnail
    const image = db.prepare('SELECT image_url FROM collection_images WHERE id = ?').get(imageId) as any;
    if (image) {
      db.prepare('UPDATE collections SET thumbnail_url = ? WHERE id = ?').run(image.image_url, collectionId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting main image:', error);
    res.status(500).json({ success: false, error: 'Failed to set main image' });
  }
});

// Delete image from collection
router.delete('/:collectionId/images/:imageId', (req, res) => {
  try {
    const db = getDb();
    const { collectionId, imageId } = req.params;

    // Get image to delete file
    const image = db.prepare('SELECT * FROM collection_images WHERE id = ?').get(imageId) as any;
    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Delete file
    const filename = image.image_url.replace('/uploads/collections/', '');
    const filepath = getUploadPath('collections', filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Delete from database
    db.prepare('DELETE FROM collection_images WHERE id = ?').run(imageId);

    // If this was the main image, set a new main
    if (image.is_main) {
      const newMain = db.prepare(`
        SELECT id FROM collection_images WHERE collection_id = ? ORDER BY order_index ASC LIMIT 1
      `).get(collectionId) as any;
      
      if (newMain) {
        db.prepare('UPDATE collection_images SET is_main = 1 WHERE id = ?').run(newMain.id);
        const newMainImage = db.prepare('SELECT image_url FROM collection_images WHERE id = ?').get(newMain.id) as any;
        db.prepare('UPDATE collections SET thumbnail_url = ? WHERE id = ?').run(newMainImage.image_url, collectionId);
      } else {
        db.prepare('UPDATE collections SET thumbnail_url = NULL WHERE id = ?').run(collectionId);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, error: 'Failed to delete image' });
  }
});

// Reorder images
router.put('/:id/reorder', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds)) {
      return res.status(400).json({ success: false, error: 'imageIds must be an array' });
    }

    const updateOrder = db.prepare('UPDATE collection_images SET order_index = ? WHERE id = ?');

    const transaction = db.transaction(() => {
      imageIds.forEach((imageId: string, index: number) => {
        updateOrder.run(index, imageId);
      });
    });

    transaction();

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering images:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder images' });
  }
});

export default router;
