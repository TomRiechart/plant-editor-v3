import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

// Plant positions in Signature Six (percentages)
const PLANT_POSITIONS = {
  moneyTree: { x: 0.15, y: 0.78, radius: 0.06 },      // Front left cream pot
  blackZZ: { x: 0.38, y: 0.72, radius: 0.08 },        // Center dark gray pot  
  philodendron: { x: 0.48, y: 0.85, radius: 0.05 },   // Center front pink pot
  birdsNest: { x: 0.78, y: 0.78, radius: 0.07 },      // Right cream pot
};

// Replacement plants
const REPLACEMENTS = [
  { position: 'moneyTree', plant: 'Succulent', file: 'succulent.jpg', color: 'red' },
  { position: 'blackZZ', plant: 'Parlor Palm', file: 'parlor-palm.jpg', color: 'blue' },
  { position: 'philodendron', plant: 'Aglaonema Beauty', file: 'aglaonema.jpg', color: 'yellow' },
  { position: 'birdsNest', plant: 'Golden Snake Plant', file: 'golden-snake.jpg', color: 'green' },
];

async function createMultiMaskedImage(imagePath, masks) {
  const metadata = await sharp(imagePath).metadata();
  console.log(`📐 Image: ${metadata.width}x${metadata.height}`);
  
  const colors = {
    red: 'rgba(239, 68, 68, 0.6)',
    blue: 'rgba(59, 130, 246, 0.6)',
    yellow: 'rgba(234, 179, 8, 0.6)',
    green: 'rgba(34, 197, 94, 0.6)',
  };
  
  const circles = masks.map(m => {
    const pos = PLANT_POSITIONS[m.position];
    const x = Math.round(metadata.width * pos.x);
    const y = Math.round(metadata.height * pos.y);
    const r = Math.round(metadata.width * pos.radius);
    console.log(`   ${m.plant}: x=${x}, y=${y}, r=${r} (${m.color})`);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[m.color]}" />`;
  }).join('\n');
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">${circles}</svg>`;
  
  return await sharp(imagePath)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
}

async function main() {
  console.log('🌿 Multi-Plant Replacement\n');
  console.log('=' .repeat(50));
  console.log('Replacing 4 plants while keeping pots unchanged\n');
  
  const collectionPath = './data/uploads/collections/signature-six-full.jpg';
  
  // Create masked image with all 4 positions marked
  console.log('1️⃣ Creating multi-mask image...');
  const maskedBuffer = await createMultiMaskedImage(collectionPath, REPLACEMENTS);
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'multi-masked.png'), maskedBuffer);
  console.log('   ✅ Saved masked preview');
  
  // Prepare image URLs
  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  
  // Load all plant images
  const plantImages = REPLACEMENTS.map(r => {
    const plantBuffer = fs.readFileSync(`./data/uploads/plants/${r.file}`);
    return {
      name: r.plant,
      imageUrl: `data:image/jpeg;base64,${plantBuffer.toString('base64')}`,
      color: r.color
    };
  });
  
  const prompt = `You are an expert image-generation engine. Replace plants in the marked circles with new plants.

CRITICAL RULES:
1. RED circle: Replace with Succulent
2. BLUE circle: Replace with Parlor Palm
3. YELLOW circle: Replace with Aglaonema Beauty (pink/green leaves)
4. GREEN circle: Replace with Golden Snake Plant (tall yellow-green striped leaves)

IMPORTANT:
- Keep ALL ceramic pots EXACTLY the same - do not change pot colors, shapes, or sizes
- Only replace the plants inside the pots
- Maintain same lighting, shadows, and perspective
- All other elements must stay unchanged
- Professional product photography quality`;

  console.log('\n2️⃣ Calling Fal.ai for 4-plant replacement...');
  console.log('   ⏱️  This takes 2-3 minutes...\n');
  
  try {
    const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
      input: {
        prompt,
        image_urls: [canvasDataUrl, ...plantImages.map(p => p.imageUrl)],
        num_images: 3,
        resolution: '4K',
        output_format: 'png',
        aspect_ratio: 'auto',
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS' && update.logs) {
          update.logs.forEach((log) => console.log(`   Fal: ${log.message}`));
        }
      },
    });

    console.log('\n✅ Fal.ai complete!');
    
    const images = result.images?.map(img => img.url) || [];
    console.log(`   Generated ${images.length} variations`);
    
    for (let i = 0; i < Math.min(images.length, 2); i++) {
      const imgUrl = images[i];
      console.log(`\n   Downloading variation ${i + 1}...`);
      const imgResponse = await fetch(imgUrl);
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
      const outputPath = path.join(OUTPUT_DIR, `4plants-AFTER-${i + 1}.png`);
      fs.writeFileSync(outputPath, imgBuffer);
      console.log(`   ✅ Saved: ${outputPath} (${Math.round(imgBuffer.length / 1024)}KB)`);
    }
    
    // Copy before image
    fs.copyFileSync(collectionPath, path.join(OUTPUT_DIR, '4plants-BEFORE.jpg'));
    console.log('\n   ✅ Saved: 4plants-BEFORE.jpg');
    
    console.log('\n✨ Done! Check results folder.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
