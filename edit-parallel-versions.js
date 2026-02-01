import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results/parallel';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Radiant Trinity - 3 plants
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
    potColor: 'light green'
  },
  { 
    id: '3',
    original: 'Snake Plant',
    replacement: 'Golden Snake',
    plantFile: 'golden-snake.jpg',
    foliageMask: { cx: 0.75, cy: 0.52, rx: 0.12, ry: 0.18 },
    potRegion: { x: 0.65, y: 0.73, w: 0.20, h: 0.12 },
    potColor: 'white'
  },
];

const NUM_VERSIONS = 3; // Generate 3 versions per edit

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

async function comparePotRegions(original, result, potRegion) {
  const origPot = await extractPotRegion(original, potRegion);
  const resPot = await extractPotRegion(result, potRegion);
  
  if (origPot.length !== resPot.length) return 0;
  
  let totalDiff = 0;
  for (let i = 0; i < origPot.length; i++) {
    totalDiff += Math.abs(origPot[i] - resPot[i]);
  }
  return 1 - (totalDiff / origPot.length / 255);
}

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

async function generateMultipleVersions(imageBuffer, edit, stepNum) {
  console.log(`\n🌱 Step ${stepNum}/3: ${edit.original} → ${edit.replacement}`);
  console.log(`   Generating ${NUM_VERSIONS} versions in parallel...`);
  
  const visualMask = await createVisualMask(imageBuffer, edit.foliageMask);
  const canvasDataUrl = `data:image/png;base64,${visualMask.toString('base64')}`;
  const plantBuffer = fs.readFileSync(`./data/uploads/plants/${edit.plantFile}`);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  const prompt = `Replace ONLY the plant foliage inside the red marked area with ${edit.replacement}.

CRITICAL: The ${edit.potColor} ceramic pot MUST remain EXACTLY unchanged.
- Same pot color, shape, and size
- Do NOT modify anything outside the red ellipse
Remove the red marker in final image.`;

  console.log('   🔄 Calling Fal.ai (3 images)...');
  
  const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
    input: {
      prompt,
      image_urls: [canvasDataUrl, plantDataUrl],
      num_images: NUM_VERSIONS,
      resolution: '4K',
      output_format: 'png',
    },
    logs: false,
  });

  const images = result.images || [];
  console.log(`   📥 Received ${images.length} images`);
  
  const versions = [];
  
  for (let i = 0; i < images.length; i++) {
    const imgUrl = images[i].url;
    const imgResponse = await fetch(imgUrl);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    
    // Verify pot preservation
    const similarity = await comparePotRegions(imageBuffer, imgBuffer, edit.potRegion);
    const passed = similarity >= 0.95;
    
    const versionLabel = String.fromCharCode(65 + i); // A, B, C
    const filename = `step${stepNum}-v${versionLabel}-${edit.replacement.replace(/ /g, '-')}.png`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), imgBuffer);
    
    const status = passed ? '✅' : '⚠️';
    console.log(`   ${status} Version ${versionLabel}: ${(similarity * 100).toFixed(1)}% pot similarity`);
    
    versions.push({
      version: versionLabel,
      filename,
      similarity,
      passed,
      buffer: imgBuffer
    });
  }
  
  return versions;
}

async function main() {
  console.log('🎯 Parallel Versions Generator');
  console.log('=' .repeat(50));
  console.log(`Each edit generates ${NUM_VERSIONS} versions for comparison\n`);
  
  const originalImage = fs.readFileSync('./data/uploads/collections/radiant-trinity.jpg');
  fs.copyFileSync('./data/uploads/collections/radiant-trinity.jpg', 
                  path.join(OUTPUT_DIR, 'ORIGINAL.jpg'));
  
  const allResults = [];
  
  // For each plant, generate 3 versions starting from original
  for (let i = 0; i < EDITS.length; i++) {
    const versions = await generateMultipleVersions(originalImage, EDITS[i], i + 1);
    allResults.push({ edit: EDITS[i], versions });
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 SUMMARY - All Versions Generated:\n');
  
  allResults.forEach((result, i) => {
    console.log(`Step ${i + 1}: ${result.edit.original} → ${result.edit.replacement}`);
    result.versions.forEach(v => {
      const status = v.passed ? '✅' : '⚠️';
      console.log(`   ${status} Version ${v.version}: ${(v.similarity * 100).toFixed(1)}% - ${v.filename}`);
    });
    console.log();
  });
  
  const totalVersions = allResults.reduce((sum, r) => sum + r.versions.length, 0);
  const passedVersions = allResults.reduce((sum, r) => sum + r.versions.filter(v => v.passed).length, 0);
  
  console.log(`✨ Generated ${totalVersions} versions total`);
  console.log(`✅ ${passedVersions} passed verification (95%+ pot similarity)`);
  console.log('📁 All versions saved in:', OUTPUT_DIR);
}

main().catch(console.error);
