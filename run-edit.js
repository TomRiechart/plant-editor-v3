import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'results');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function createMaskedImage(imagePath, masks) {
  const metadata = await sharp(imagePath).metadata();
  console.log(`📐 Image: ${metadata.width}x${metadata.height}`);
  
  // Create SVG with circles for each mask
  const circles = masks.map(m => {
    const x = Math.round(metadata.width * m.x);
    const y = Math.round(metadata.height * m.y);
    const r = Math.round(metadata.width * m.radius);
    console.log(`   Mask: x=${x}, y=${y}, r=${r}`);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(239, 68, 68, 0.6)" />`;
  }).join('\n');
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">${circles}</svg>`;
  
  const maskedBuffer = await sharp(imagePath)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
  
  return maskedBuffer;
}

async function generateWithLocalServer(maskedBuffer, plantPath, plantName) {
  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync(plantPath);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  console.log(`\n🎨 Calling local server for ${plantName}...`);
  console.log('   ⏱️  This takes 2-3 minutes...\n');
  
  const response = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canvasDataUrl,
      plants: [{
        name: plantName,
        imageUrl: plantDataUrl,
        color: 'red'
      }],
      mode: 'single'
    })
  });
  
  return await response.json();
}

async function main() {
  console.log('🌿 Easyplant Collection Editor\n');
  console.log('=' .repeat(50));
  
  const collectionPath = path.join(__dirname, 'signature-six-full.jpg');
  
  // Target: Money Tree (front left small plant in cream pot)
  // Position: approximately x=15%, y=82%
  const masks = [
    { x: 0.15, y: 0.78, radius: 0.07 }  // Money Tree area
  ];
  
  // Replacement plant
  const replacementPlant = {
    name: 'Anthurium Red',
    path: path.join(__dirname, 'anthurium-red.jpg')
  };
  
  console.log('\n1️⃣ Creating masked image...');
  const maskedBuffer = await createMaskedImage(collectionPath, masks);
  
  // Save masked preview
  const maskedPath = path.join(OUTPUT_DIR, 'signature-six-masked.png');
  fs.writeFileSync(maskedPath, maskedBuffer);
  console.log(`   ✅ Saved: ${maskedPath}`);
  
  // Copy original as "before"
  const beforePath = path.join(OUTPUT_DIR, 'signature-six-BEFORE.jpg');
  fs.copyFileSync(collectionPath, beforePath);
  console.log(`   ✅ Before image: ${beforePath}`);
  
  console.log('\n2️⃣ Generating edited image...');
  const result = await generateWithLocalServer(maskedBuffer, replacementPlant.path, replacementPlant.name);
  
  if (result.success && result.data?.images?.length > 0) {
    console.log(`\n3️⃣ Downloading ${result.data.images.length} variations...`);
    
    for (let i = 0; i < result.data.images.length; i++) {
      const imgUrl = result.data.images[i];
      console.log(`   Downloading variation ${i + 1}...`);
      
      try {
        const imgResponse = await fetch(imgUrl);
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
        const outputPath = path.join(OUTPUT_DIR, `signature-six-AFTER-${i + 1}.png`);
        fs.writeFileSync(outputPath, imgBuffer);
        console.log(`   ✅ Saved: ${outputPath} (${Math.round(imgBuffer.length / 1024)}KB)`);
      } catch (e) {
        console.log(`   ⚠️ Error: ${e.message}`);
      }
    }
    
    console.log('\n✨ Done! Check results folder.');
  } else {
    console.log('❌ Generation failed:', result.error || result);
  }
}

main().catch(console.error);
