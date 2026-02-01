import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results/precise';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Precise masks - ONLY covering foliage, NOT the pot
// Using polygons/ellipses positioned ABOVE the pot rim
const EDITS = [
  { 
    id: '1',
    original: 'Money Tree',
    replacement: 'Anthurium Red',
    plantFile: 'anthurium-red.jpg',
    // Mask only the foliage area, not the pot
    // Original pot rim is around y=0.82, so mask starts at y=0.72 and goes up
    maskType: 'ellipse',
    mask: { cx: 0.15, cy: 0.72, rx: 0.055, ry: 0.08 }, // taller ellipse above pot
    potDesc: 'small round cream/beige ceramic pot - DO NOT MODIFY'
  },
  { 
    id: '2',
    original: 'Black ZZ Plant',
    replacement: 'Calathea',
    plantFile: 'calathea.jpg',
    maskType: 'ellipse',
    mask: { cx: 0.38, cy: 0.62, rx: 0.09, ry: 0.12 }, // covers ZZ leaves above pot
    potDesc: 'medium dark charcoal gray ceramic pot - DO NOT MODIFY'
  },
  { 
    id: '3',
    original: 'Heartleaf Philodendron',
    replacement: 'Hoya Tricolor',
    plantFile: 'hoya-tricolor.jpg',
    maskType: 'ellipse',
    mask: { cx: 0.48, cy: 0.78, rx: 0.045, ry: 0.055 }, // small plant above pink pot
    potDesc: 'small round dusty pink/rose ceramic pot - DO NOT MODIFY'
  },
  { 
    id: '4',
    original: 'Birds Nest Fern',
    replacement: 'Parlor Palm',
    plantFile: 'parlor-palm.jpg',
    maskType: 'ellipse',
    mask: { cx: 0.78, cy: 0.70, rx: 0.065, ry: 0.09 }, // fern leaves above cream pot
    potDesc: 'small round cream/beige ceramic pot - DO NOT MODIFY'
  },
];

async function createPreciseMask(imageBuffer, edit) {
  const metadata = await sharp(imageBuffer).metadata();
  const m = edit.mask;
  
  let svg;
  if (edit.maskType === 'ellipse') {
    const cx = Math.round(metadata.width * m.cx);
    const cy = Math.round(metadata.height * m.cy);
    const rx = Math.round(metadata.width * m.rx);
    const ry = Math.round(metadata.height * m.ry);
    
    console.log(`   Ellipse mask: cx=${cx}, cy=${cy}, rx=${rx}, ry=${ry}`);
    
    svg = `<svg width="${metadata.width}" height="${metadata.height}">
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(239, 68, 68, 0.5)" />
    </svg>`;
  }
  
  return await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
}

async function runEdit(imageBuffer, edit, stepNum) {
  console.log(`\n🌱 Step ${stepNum}/4: ${edit.original} → ${edit.replacement}`);
  
  const maskedBuffer = await createPreciseMask(imageBuffer, edit);
  
  // Save mask preview
  fs.writeFileSync(path.join(OUTPUT_DIR, `step${stepNum}-mask.png`), maskedBuffer);
  
  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync(`./data/uploads/plants/${edit.plantFile}`);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  const prompt = `Replace ONLY the plant foliage inside the red marked area with ${edit.replacement} foliage.

ABSOLUTE REQUIREMENTS:
- The ${edit.potDesc}
- The pot is OUTSIDE the red mask - DO NOT TOUCH IT
- Only modify what's inside the red ellipse (the leaves/foliage)
- Keep the exact same pot visible below the new plant
- Match the lighting and shadows of the scene

The new ${edit.replacement} should fit naturally in the same space.
Remove the red marker in the final image.`;

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
  
  fs.writeFileSync(path.join(OUTPUT_DIR, `step${stepNum}-result.png`), imgBuffer);
  console.log(`   ✅ Saved step ${stepNum} result`);
  
  // Compress for next step
  const compressedBuffer = await sharp(imgBuffer)
    .resize(2400, null, { withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toBuffer();
  
  return compressedBuffer;
}

async function main() {
  console.log('🎯 Precise Mask Plant Replacement');
  console.log('=' .repeat(50));
  console.log('Using ellipse masks positioned ABOVE pots\n');
  
  let currentImage = fs.readFileSync('./data/uploads/collections/signature-six-full.jpg');
  fs.copyFileSync('./data/uploads/collections/signature-six-full.jpg', 
                  path.join(OUTPUT_DIR, 'step0-original.jpg'));
  
  for (let i = 0; i < EDITS.length; i++) {
    try {
      currentImage = await runEdit(currentImage, EDITS[i], i + 1);
      await new Promise(r => setTimeout(r, 3000));
    } catch (error) {
      console.error(`❌ Step ${i + 1} failed:`, error.message);
      break;
    }
  }
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'FINAL-precise.jpg'), currentImage);
  console.log('\n' + '=' .repeat(50));
  console.log('✨ DONE! Check: FINAL-precise.jpg');
}

main().catch(console.error);
