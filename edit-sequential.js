import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

// Plants to replace (one at a time for better quality)
const EDITS = [
  { 
    name: 'edit1',
    position: { x: 0.15, y: 0.78, radius: 0.06 },
    plant: 'Succulent',
    plantFile: 'succulent.jpg',
    description: 'small succulent plant in ceramic pot'
  },
  { 
    name: 'edit2',
    position: { x: 0.78, y: 0.76, radius: 0.08 },
    plant: 'Golden Snake Plant',
    plantFile: 'golden-snake.jpg',
    description: 'tall snake plant with yellow-green striped leaves'
  },
];

async function createMaskedImage(imageBuffer, position) {
  const metadata = await sharp(imageBuffer).metadata();
  
  const x = Math.round(metadata.width * position.x);
  const y = Math.round(metadata.height * position.y);
  const r = Math.round(metadata.width * position.radius);
  
  console.log(`   Mask: x=${x}, y=${y}, r=${r}`);
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">
    <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(239, 68, 68, 0.6)" />
  </svg>`;
  
  return await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
}

async function replaceOnePlant(imageBuffer, edit, index) {
  console.log(`\n📍 Edit ${index + 1}: Replacing with ${edit.plant}...`);
  
  const maskedBuffer = await createMaskedImage(imageBuffer, edit.position);
  
  // Save mask preview
  fs.writeFileSync(path.join(OUTPUT_DIR, `seq-mask-${index + 1}.png`), maskedBuffer);
  
  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync(`./data/uploads/plants/${edit.plantFile}`);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  const prompt = `Replace the plant inside the red circle with a ${edit.description}.
CRITICAL: Keep the ceramic pot exactly the same - same color, same shape, same size.
Only replace the plant foliage. Professional product photography.`;

  console.log('   Calling Fal.ai...');
  
  const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
    input: {
      prompt,
      image_urls: [canvasDataUrl, plantDataUrl],
      num_images: 1,
      resolution: '4K',
      output_format: 'png',
    },
    logs: false,
  });

  const imageUrl = result.images?.[0]?.url;
  if (!imageUrl) throw new Error('No image returned');
  
  console.log('   Downloading result...');
  const imgResponse = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
  
  fs.writeFileSync(path.join(OUTPUT_DIR, `seq-result-${index + 1}.png`), imgBuffer);
  console.log(`   ✅ Saved seq-result-${index + 1}.png`);
  
  return imgBuffer;
}

async function main() {
  console.log('🌿 Sequential Plant Replacement\n');
  console.log('=' .repeat(50));
  
  // Start with original
  let currentImage = fs.readFileSync('./data/uploads/collections/signature-six-full.jpg');
  fs.copyFileSync('./data/uploads/collections/signature-six-full.jpg', 
                  path.join(OUTPUT_DIR, 'seq-BEFORE.jpg'));
  
  console.log('Starting sequential edits (2 plants)...');
  console.log('⏱️  Each edit takes ~2-3 minutes\n');
  
  for (let i = 0; i < EDITS.length; i++) {
    try {
      currentImage = await replaceOnePlant(currentImage, EDITS[i], i);
    } catch (error) {
      console.error(`❌ Edit ${i + 1} failed:`, error.message);
      break;
    }
  }
  
  // Final result
  fs.writeFileSync(path.join(OUTPUT_DIR, 'seq-FINAL.png'), currentImage);
  console.log('\n✨ Done! Final result: seq-FINAL.png');
}

main().catch(console.error);
