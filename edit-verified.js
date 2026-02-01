import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results/verified';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Each edit includes pot region for verification
const EDITS = [
  { 
    id: '1',
    original: 'Money Tree',
    replacement: 'Anthurium Red',
    plantFile: 'anthurium-red.jpg',
    // Mask for plant foliage ONLY (above pot)
    foliageMask: { cx: 0.15, cy: 0.70, rx: 0.05, ry: 0.07 },
    // Pot region for verification (should NOT change)
    potRegion: { x: 0.10, y: 0.78, w: 0.10, h: 0.08 },
    potColor: 'cream'
  },
  { 
    id: '2',
    original: 'Black ZZ Plant',
    replacement: 'Calathea',
    plantFile: 'calathea.jpg',
    foliageMask: { cx: 0.38, cy: 0.58, rx: 0.08, ry: 0.12 },
    potRegion: { x: 0.30, y: 0.72, w: 0.16, h: 0.10 },
    potColor: 'dark gray'
  },
  { 
    id: '3',
    original: 'Heartleaf Philodendron',
    replacement: 'Hoya Tricolor',
    plantFile: 'hoya-tricolor.jpg',
    foliageMask: { cx: 0.48, cy: 0.76, rx: 0.04, ry: 0.05 },
    potRegion: { x: 0.44, y: 0.82, w: 0.08, h: 0.06 },
    potColor: 'pink'
  },
  { 
    id: '4',
    original: 'Birds Nest Fern',
    replacement: 'Parlor Palm',
    plantFile: 'parlor-palm.jpg',
    foliageMask: { cx: 0.78, cy: 0.66, rx: 0.055, ry: 0.09 },
    potRegion: { x: 0.73, y: 0.77, w: 0.10, h: 0.08 },
    potColor: 'cream'
  },
];

// Extract pot region from image for comparison (fixed size for comparison)
async function extractPotRegion(imageBuffer, potRegion, targetSize = 100) {
  const metadata = await sharp(imageBuffer).metadata();
  const x = Math.round(metadata.width * potRegion.x);
  const y = Math.round(metadata.height * potRegion.y);
  const w = Math.round(metadata.width * potRegion.w);
  const h = Math.round(metadata.height * potRegion.h);
  
  // Extract and resize to fixed size for consistent comparison
  return await sharp(imageBuffer)
    .extract({ left: x, top: y, width: w, height: h })
    .resize(targetSize, targetSize, { fit: 'fill' })
    .raw()
    .toBuffer();
}

// Compare two pot regions - returns similarity score (0-1)
async function comparePotRegions(original, result, potRegion) {
  const targetSize = 100; // Fixed comparison size
  const origPot = await extractPotRegion(original, potRegion, targetSize);
  const resPot = await extractPotRegion(result, potRegion, targetSize);
  
  if (origPot.length !== resPot.length) {
    console.log(`   ⚠️ Size mismatch: ${origPot.length} vs ${resPot.length}`);
    return 0;
  }
  
  // Calculate mean absolute difference
  let totalDiff = 0;
  for (let i = 0; i < origPot.length; i++) {
    totalDiff += Math.abs(origPot[i] - resPot[i]);
  }
  const avgDiff = totalDiff / origPot.length;
  
  // Convert to similarity (0-1 where 1 = identical)
  const similarity = 1 - (avgDiff / 255);
  return similarity;
}

// Create binary mask for inpainting
async function createBinaryMask(imageBuffer, foliageMask) {
  const metadata = await sharp(imageBuffer).metadata();
  const m = foliageMask;
  
  const cx = Math.round(metadata.width * m.cx);
  const cy = Math.round(metadata.height * m.cy);
  const rx = Math.round(metadata.width * m.rx);
  const ry = Math.round(metadata.height * m.ry);
  
  // White ellipse on black background = area to inpaint
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">
    <rect width="100%" height="100%" fill="black"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>
  </svg>`;
  
  return await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

// Create visual mask overlay for debugging
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
  console.log(`\n🌱 Step ${stepNum}/4: ${edit.original} → ${edit.replacement}`);
  
  let currentMask = { ...edit.foliageMask };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`   📍 Attempt ${attempt}/${maxRetries}`);
    
    // Create masks
    const visualMask = await createVisualMask(imageBuffer, currentMask);
    fs.writeFileSync(path.join(OUTPUT_DIR, `step${stepNum}-attempt${attempt}-mask.png`), visualMask);
    
    const canvasDataUrl = `data:image/png;base64,${visualMask.toString('base64')}`;
    const plantBuffer = fs.readFileSync(`./data/uploads/plants/${edit.plantFile}`);
    const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
    
    const prompt = `Replace ONLY the plant foliage inside the red marked area with ${edit.replacement}.

CRITICAL: The ${edit.potColor} ceramic pot below MUST remain EXACTLY unchanged.
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
      
      // Save result
      fs.writeFileSync(path.join(OUTPUT_DIR, `step${stepNum}-attempt${attempt}-result.png`), resultBuffer);
      
      // VERIFY: Compare pot regions
      console.log('   🔍 Verifying pot preservation...');
      const similarity = await comparePotRegions(imageBuffer, resultBuffer, edit.potRegion);
      console.log(`   📊 Pot similarity: ${(similarity * 100).toFixed(1)}%`);
      
      // Threshold: 95% similarity required
      if (similarity >= 0.95) {
        console.log(`   ✅ PASSED! Pot preserved correctly.`);
        
        // Compress for next step
        const compressedBuffer = await sharp(resultBuffer)
          .resize(2400, null, { withoutEnlargement: true })
          .jpeg({ quality: 95 })
          .toBuffer();
        
        return { success: true, buffer: compressedBuffer, similarity };
      } else {
        console.log(`   ❌ FAILED! Pot changed too much (need 95%+)`);
        
        // Shrink mask for next attempt (move further from pot)
        currentMask.ry = currentMask.ry * 0.85;
        currentMask.cy = currentMask.cy - 0.02; // Move up
        console.log(`   🔧 Adjusting mask: smaller, higher`);
      }
      
    } catch (error) {
      console.error(`   ❌ API Error: ${error.message}`);
    }
    
    // Delay between retries
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log(`   ⚠️ All ${maxRetries} attempts failed for step ${stepNum}`);
  return { success: false, buffer: imageBuffer, similarity: 0 };
}

async function main() {
  console.log('🎯 Verified Plant Replacement');
  console.log('=' .repeat(50));
  console.log('Each edit is verified - pot must be 95%+ similar\n');
  
  let currentImage = fs.readFileSync('./data/uploads/collections/signature-six-full.jpg');
  fs.copyFileSync('./data/uploads/collections/signature-six-full.jpg', 
                  path.join(OUTPUT_DIR, 'step0-original.jpg'));
  
  const results = [];
  
  for (let i = 0; i < EDITS.length; i++) {
    const result = await runEditWithVerification(currentImage, EDITS[i], i + 1);
    results.push({ edit: EDITS[i], ...result });
    
    if (result.success) {
      currentImage = result.buffer;
    } else {
      console.log(`\n⚠️ Step ${i + 1} failed verification - using previous image`);
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Save final
  fs.writeFileSync(path.join(OUTPUT_DIR, 'FINAL-verified.jpg'), currentImage);
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 SUMMARY:');
  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌';
    console.log(`   ${status} Step ${i+1}: ${r.edit.original} → ${r.edit.replacement} (${(r.similarity*100).toFixed(1)}%)`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n✨ ${successCount}/4 edits passed verification`);
  console.log('📁 Results in:', OUTPUT_DIR);
}

main().catch(console.error);
