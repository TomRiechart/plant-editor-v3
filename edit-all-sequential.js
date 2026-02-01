import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results/combined';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Sequential edits - each builds on the previous
const EDITS = [
  { 
    id: '1',
    original: 'Money Tree',
    replacement: 'Anthurium Red',
    plantFile: 'anthurium-red.jpg',
    position: { x: 0.15, y: 0.78, radius: 0.055 },
    potDesc: 'small round cream/beige ceramic pot'
  },
  { 
    id: '2',
    original: 'Black ZZ Plant',
    replacement: 'Calathea',
    plantFile: 'calathea.jpg',
    position: { x: 0.38, y: 0.72, radius: 0.085 },
    potDesc: 'medium dark charcoal gray ceramic pot'
  },
  { 
    id: '3',
    original: 'Heartleaf Philodendron',
    replacement: 'Hoya Tricolor',
    plantFile: 'hoya-tricolor.jpg',
    position: { x: 0.48, y: 0.84, radius: 0.045 },
    potDesc: 'small round dusty pink/rose ceramic pot'
  },
  { 
    id: '4',
    original: 'Birds Nest Fern',
    replacement: 'Parlor Palm',
    plantFile: 'parlor-palm.jpg',
    position: { x: 0.78, y: 0.77, radius: 0.06 },
    potDesc: 'small round cream/beige ceramic pot'
  },
];

async function createMaskedImage(imageBuffer, position) {
  const metadata = await sharp(imageBuffer).metadata();
  
  const x = Math.round(metadata.width * position.x);
  const y = Math.round(metadata.height * position.y);
  const r = Math.round(metadata.width * position.radius);
  
  console.log(`   Mask position: x=${x}, y=${y}, r=${r}`);
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">
    <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(239, 68, 68, 0.5)" />
  </svg>`;
  
  return await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
}

async function compressForNextStep(imageBuffer) {
  // Resize to reasonable size to avoid API limits while keeping quality
  return await sharp(imageBuffer)
    .resize(2400, null, { withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toBuffer();
}

async function runEdit(imageBuffer, edit, stepNum) {
  console.log(`\n🌱 Step ${stepNum}/4: ${edit.original} → ${edit.replacement}`);
  
  const maskedBuffer = await createMaskedImage(imageBuffer, edit.position);
  
  // Save mask preview
  fs.writeFileSync(path.join(OUTPUT_DIR, `step${stepNum}-mask.png`), maskedBuffer);
  
  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync(`./data/uploads/plants/${edit.plantFile}`);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  const prompt = `Replace ONLY the plant inside the red circle with a ${edit.replacement}.

CRITICAL - POT MUST NOT CHANGE:
- The pot is a ${edit.potDesc}
- Keep EXACT same pot - identical size, shape, and color
- Only replace plant foliage, keep pot exactly as is

Remove the red circle marker completely.
Professional product photography quality.`;

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
  
  // Save this step's result
  fs.writeFileSync(path.join(OUTPUT_DIR, `step${stepNum}-result.png`), imgBuffer);
  console.log(`   ✅ Saved step ${stepNum} result`);
  
  // Compress for next step to avoid size limits
  const compressedBuffer = await compressForNextStep(imgBuffer);
  console.log(`   📦 Compressed for next step: ${Math.round(compressedBuffer.length/1024)}KB`);
  
  return compressedBuffer;
}

async function main() {
  console.log('🌿 Sequential 4-Plant Replacement');
  console.log('=' .repeat(50));
  console.log('Building combined image step by step\n');
  
  // Start with original
  let currentImage = fs.readFileSync('./data/uploads/collections/signature-six-full.jpg');
  fs.copyFileSync('./data/uploads/collections/signature-six-full.jpg', 
                  path.join(OUTPUT_DIR, 'step0-original.jpg'));
  console.log('✅ Starting with original image');
  
  for (let i = 0; i < EDITS.length; i++) {
    try {
      currentImage = await runEdit(currentImage, EDITS[i], i + 1);
      // Small delay between API calls
      await new Promise(r => setTimeout(r, 3000));
    } catch (error) {
      console.error(`❌ Step ${i + 1} failed:`, error.message);
      break;
    }
  }
  
  // Save final combined result
  fs.writeFileSync(path.join(OUTPUT_DIR, 'FINAL-all-4-replaced.jpg'), currentImage);
  console.log('\n' + '=' .repeat(50));
  console.log('✨ DONE! Final image: FINAL-all-4-replaced.jpg');
  console.log('📁 All steps saved in:', OUTPUT_DIR);
}

main().catch(console.error);
