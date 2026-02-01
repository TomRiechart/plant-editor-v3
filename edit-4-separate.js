import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

// 4 separate edits from original
const EDITS = [
  { 
    id: 'A',
    position: { x: 0.15, y: 0.78, radius: 0.06 },
    plant: 'Succulent',
    plantFile: 'succulent.jpg',
  },
  { 
    id: 'B',
    position: { x: 0.38, y: 0.72, radius: 0.09 },
    plant: 'Parlor Palm',
    plantFile: 'parlor-palm.jpg',
  },
  { 
    id: 'C',
    position: { x: 0.48, y: 0.82, radius: 0.05 },
    plant: 'Aglaonema',
    plantFile: 'aglaonema.jpg',
  },
  { 
    id: 'D',
    position: { x: 0.78, y: 0.76, radius: 0.07 },
    plant: 'Golden Snake',
    plantFile: 'golden-snake.jpg',
  },
];

async function createMaskedImage(imagePath, position) {
  const metadata = await sharp(imagePath).metadata();
  
  const x = Math.round(metadata.width * position.x);
  const y = Math.round(metadata.height * position.y);
  const r = Math.round(metadata.width * position.radius);
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">
    <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(239, 68, 68, 0.6)" />
  </svg>`;
  
  return await sharp(imagePath)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
}

async function runEdit(edit) {
  console.log(`\n🌱 Edit ${edit.id}: ${edit.plant}`);
  
  const imagePath = './data/uploads/collections/signature-six-full.jpg';
  const maskedBuffer = await createMaskedImage(imagePath, edit.position);
  
  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync(`./data/uploads/plants/${edit.plantFile}`);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  const prompt = `Replace the plant inside the red circle with a ${edit.plant}. Keep the ceramic pot exactly the same color and shape. Professional product photography.`;

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
  
  const imgResponse = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
  
  const outputPath = path.join(OUTPUT_DIR, `edit-${edit.id}-${edit.plant.replace(/ /g, '-')}.png`);
  fs.writeFileSync(outputPath, imgBuffer);
  console.log(`   ✅ Saved: ${outputPath}`);
  
  return outputPath;
}

async function main() {
  console.log('🌿 4 Separate Plant Edits\n');
  console.log('=' .repeat(50));
  console.log('Running 4 edits in parallel...\n');
  
  // Copy original
  fs.copyFileSync('./data/uploads/collections/signature-six-full.jpg', 
                  path.join(OUTPUT_DIR, 'edit-ORIGINAL.jpg'));
  
  // Run all 4 in parallel (with slight stagger)
  const results = [];
  for (const edit of EDITS) {
    try {
      const result = await runEdit(edit);
      results.push({ edit, result });
    } catch (error) {
      console.error(`❌ Edit ${edit.id} failed:`, error.message);
    }
    // Small delay between calls
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✨ Completed', results.length, 'of', EDITS.length, 'edits');
}

main().catch(console.error);
