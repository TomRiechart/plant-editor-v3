import 'dotenv/config';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const dbPath = './data/plant-editor.db';
const db = new Database(dbPath);

console.log('🔧 Setting up test data...\n');

// Create collection
const collectionId = uuidv4();
db.prepare(`
  INSERT INTO collections (id, name, thumbnail_url)
  VALUES (?, ?, ?)
`).run(collectionId, 'Modern Living Room', '/uploads/collections/living-room.jpg');
console.log('✅ Created collection: Modern Living Room');

// Add main image to collection
const mainImageId = uuidv4();
db.prepare(`
  INSERT INTO collection_images (id, collection_id, image_url, is_main, name, order_index)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(mainImageId, collectionId, '/uploads/collections/living-room.jpg', 1, 'Living Room', 0);
console.log('✅ Added main image');

// Add plants
const plants = [
  { name: 'Money Tree', file: 'money-tree.jpg' },
  { name: 'Calathea', file: 'calathea.jpg' },
  { name: 'Cast Iron Plant', file: 'cast-iron.jpg' },
];

for (const plant of plants) {
  const plantId = uuidv4();
  const imageUrl = `/uploads/plants/${plant.file}`;
  db.prepare(`
    INSERT INTO plants (id, name, image_url, thumbnail_url)
    VALUES (?, ?, ?, ?)
  `).run(plantId, plant.name, imageUrl, imageUrl);
  console.log(`✅ Added plant: ${plant.name}`);
}

console.log('\n📊 Database populated!');
console.log('-------------------\n');

// Now test the generate API
console.log('🎨 Testing Fal.ai generation...\n');

// Read the living room image and convert to base64
const imagePath = './data/uploads/collections/living-room.jpg';
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');
const canvasDataUrl = `data:image/jpeg;base64,${base64Image}`;

// Read the money tree plant image
const plantPath = './data/uploads/plants/money-tree.jpg';
const plantBuffer = fs.readFileSync(plantPath);
const plantBase64 = plantBuffer.toString('base64');
const plantDataUrl = `data:image/jpeg;base64,${plantBase64}`;

console.log('📤 Sending to Fal.ai...');
console.log('   Mode: single');
console.log('   Plant: Money Tree');
console.log('   This will take 2-3 minutes...\n');

// Call the generate API
const response = await fetch('http://localhost:3000/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    canvasDataUrl,
    plants: [{
      name: 'Money Tree',
      imageUrl: plantDataUrl,
      color: 'red'
    }],
    mode: 'single'
  })
});

const result = await response.json();

if (result.success) {
  console.log('✅ Generation successful!');
  console.log(`📸 Generated ${result.data.images.length} variations:`);
  result.data.images.forEach((url, i) => {
    console.log(`   ${i + 1}. ${url.substring(0, 80)}...`);
  });
} else {
  console.log('❌ Generation failed:', result.error);
}

db.close();
