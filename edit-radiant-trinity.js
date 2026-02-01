import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results/radiant-trinity';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Radiant Trinity collection - 3 plants to replace
const EDITS = [
  { 
    id: '1',
    original: 'ZZ Plant',
    replacement: 'Calathea',
    plantFile: 'calathea.jpg',
    foliageMask: { cx: 0.30, cy: 0.45, rx: 0.18, ry: 0.22 },
    potRegion: { x: 0.15, y: 0.72, w: 0.28, h: 0.12 },
    potColor: 'sage green'
  },
  { 
    id: '2',
    original: 'Small Plant',
    replacement: 'Succulent',
    plantFile: 'succulent.jpg',
    foliageMask: { cx: 0.50, cy: 0.68, rx: 0.07, ry: 0.08 },
    potRegion: { x: 0.43, y: 0.78, w: 0.14, h: 0.10 },
    potColor: 'light green/lime'
  },
  { 
    id: '3',
    original: 'Snake Plant',
    replacement: 'Golden Snake Plant',
    plantFile: 'golden-snake.jpg',
    foliageMask: { cx: 0.75, cy: 0.52, rx: 0.12, ry: 0.18 },
    potRegion: { x: 0.65, y: 0.73, w: 0.20, h: 0.12 },
    potColor: 'white'
  },
];

// Extract pot region for comparison (fixed size)
async function extractPotRegion(imageBuffer, potRegion, targetSize = 100) {
  const metadata = await sharp(imageBuffer).metadata();
  const x = Math.round(metadata.width * potRegion.x);
  const y = Math.round(metadata.height * potRegion.y);
  const w = Math.round(metadata.width * potRegion.w);
  const h = Math.round(metadata.height * potRegion.h);
  
  return await sharp(imageBuffer)
    .extract({ left: x, top: y, width: w, height: h })
    .resize(targetSize, targetSize, { fit: 'fill' })
    .raw()
    .toBuffer();
}

// Compare pot regions
async function comparePotRegions(original, result, potRegion) {
  const targetSize = 100;
  const origPot = await extractPotRegion(original, potRegion, targetSize);
  const resPot = await extractPotRegion(result, potRegion, targetSize);
  
  if (origPot.length !== resPot.length) return 0;
  
  let totalDiff = 0;
  for (let i = 0; i < origPot.length; i++) {
    totalDiff += Math.abs(origPot[i] - resPot[i]);
  }
  const avgDiff = totalDiff / origPot.length;
  return 1 - (avgDiff / 255);
}

// Create visual mask
async function createVisualMask(imageBuffer, foliageMask) {
  const metadata = await sharp(imageBuffer).metadata();
  const m = foliageMask;
  
  const cx = Math.round(metadata.width * m.cx);
  const cy = Math.round(metadata.height * m.cy);
  const rx = Math.round(metadata.width * m.rx);
  const ry = Math.round(metadata.height * m.ry);
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(239, 68, 68, 0.5)"/>
  </svg>`;
  
  return await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
}

async function runEditWithVerification(imageBuffer, edit, stepNum, maxRetries = 3) {
  console.log(`\n🌱 Step ${stepNum}/3: ${edit.original} → ${edit.replacement}`);
  
  let currentMask = { ...edit.foliageMask };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`   📍 Attempt ${attempt}/${maxRetries}`);
    
    const visualMask = await createVisualMask(imageBuffer, currentMask);
    fs.writeFileSync(path.join(OUTPUT_DIR, `step${stepNum}-attempt${attempt}-mask.png`), visualMask);
    
    const canvasDataUrl = `data:image/png;base64,${visualMask.toString('base64')}`;
    const plantBuffer = fs.readFileSync(`./data/uploads/plants/${edit.plantFile}`);
    const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
    
    const prompt = `Replace ONLY the plant foliage inside the red marked area with ${edit.replacement}.

CRITICAL: The ${edit.potColor} ceramic pot MUST remain EXACTLY unchanged.
- Same pot color
- Same pot shape  
- Same pot size
- Do NOT modify anything outside the red ellipse

Only replace the leaves/foliage. Keep the pot identical.
Remove the red marker in final image.`;

    console.log('   🔄 Calling Fal.ai...');
    
    try {
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
      const resultBuffer = Buffer.from(await imgResponse.arrayBuffer());
      
      fs.writeFileSync(path.join(OUTPUT_DIR, `step${stepNum}-attempt${attempt}-result.png`), resultBuffer);
      
      console.log('   🔍 Verifying pot preservation...');
      const similarity = await comparePotRegions(imageBuffer, resultBuffer, edit.potRegion);
      console.log(`   📊 Pot similarity: ${(similarity * 100).toFixed(1)}%`);
      
      if (similarity >= 0.95) {
        console.log(`   ✅ PASSED! Pot preserved correctly.`);
        
        const compressedBuffer = await sharp(resultBuffer)
          .resize(2400, null, { withoutEnlargement: true })
          .jpeg({ quality: 95 })
          .toBuffer();
        
        return { success: true, buffer: compressedBuffer, similarity };
      } else {
        console.log(`   ❌ FAILED! Pot changed too much (need 95%+)`);
        currentMask.ry = currentMask.ry * 0.85;
        currentMask.cy = currentMask.cy - 0.02;
        console.log(`   🔧 Adjusting mask: smaller, higher`);
      }
      
    } catch (error) {
      console.error(`   ❌ API Error: ${error.message}`);
    }
    
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log(`   ⚠️ All ${maxRetries} attempts failed`);
  return { success: false, buffer: imageBuffer, similarity: 0 };
}

async function main() {
  console.log('🎯 Radiant Trinity - Verified Plant Replacement');
  console.log('=' .repeat(50));
  console.log('Replacing all 3 plants with verification\n');
  
  let currentImage = fs.readFileSync('./data/uploads/collections/radiant-trinity.jpg');
  fs.copyFileSync('./data/uploads/collections/radiant-trinity.jpg', 
                  path.join(OUTPUT_DIR, 'ORIGINAL.jpg'));
  
  const results = [];
  
  for (let i = 0; i < EDITS.length; i++) {
    const result = await runEditWithVerification(currentImage, EDITS[i], i + 1);
    results.push({ edit: EDITS[i], ...result });
    
    if (result.success) {
      currentImage = result.buffer;
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'FINAL.jpg'), currentImage);
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 SUMMARY:');
  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌';
    console.log(`   ${status} Step ${i+1}: ${r.edit.original} → ${r.edit.replacement} (${(r.similarity*100).toFixed(1)}%)`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n✨ ${successCount}/3 edits passed verification`);
}

main().catch(console.error);
