import 'dotenv/config';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const FAL_API_KEY = process.env.FAL_API_KEY;
const OUTPUT_DIR = './data/uploads/results';

if (!FAL_API_KEY) {
  console.error('❌ FAL_API_KEY not set in .env');
  process.exit(1);
}

async function createMaskedImage(imagePath, masks) {
  const metadata = await sharp(imagePath).metadata();
  console.log(`📐 Image: ${metadata.width}x${metadata.height}`);
  
  const circles = masks.map(m => {
    const x = Math.round(metadata.width * m.x);
    const y = Math.round(metadata.height * m.y);
    const r = Math.round(metadata.width * m.radius);
    console.log(`   Mask: x=${x}, y=${y}, r=${r}`);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(239, 68, 68, 0.6)" />`;
  }).join('\n');
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">${circles}</svg>`;
  
  return await sharp(imagePath)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
}

async function callFalAiDirect(imageBuffer, plantBuffer, plantName) {
  const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  const prompt = `Replace the plant inside the red circle with a ${plantName}. 
Keep the exact same ceramic pot. Keep all other plants and elements unchanged.
Photorealistic, professional product photography, clean white/cream background.`;

  console.log(`\n🎨 Calling Fal.ai directly...`);
  console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
  console.log(`   ⏱️  This takes 2-3 minutes...\n`);

  const response = await fetch('https://fal.run/fal-ai/flux-pro/v1.1-ultra', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      image_url: imageDataUrl,
      num_images: 1,
      enable_safety_checker: false,
      output_format: 'png'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fal.ai error: ${response.status} ${text}`);
  }

  return await response.json();
}

async function main() {
  console.log('🌿 Direct Fal.ai Editor\n');
  console.log('=' .repeat(50));
  
  const collectionPath = './data/uploads/collections/signature-six-full.jpg';
  const plantPath = './data/uploads/plants/anthurium-red.jpg';
  
  // Money Tree position (front left)
  const masks = [
    { x: 0.15, y: 0.78, radius: 0.07 }
  ];
  
  console.log('\n1️⃣ Creating masked image...');
  const maskedBuffer = await createMaskedImage(collectionPath, masks);
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'direct-masked.png'), maskedBuffer);
  console.log('   ✅ Saved masked preview');
  
  fs.copyFileSync(collectionPath, path.join(OUTPUT_DIR, 'direct-BEFORE.jpg'));
  console.log('   ✅ Saved before image');
  
  console.log('\n2️⃣ Calling Fal.ai...');
  const plantBuffer = fs.readFileSync(plantPath);
  
  try {
    const result = await callFalAiDirect(maskedBuffer, plantBuffer, 'Anthurium Red');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.images && result.images.length > 0) {
      for (let i = 0; i < result.images.length; i++) {
        const imgUrl = result.images[i].url;
        console.log(`   Downloading image ${i + 1}...`);
        const imgResponse = await fetch(imgUrl);
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
        fs.writeFileSync(path.join(OUTPUT_DIR, `direct-AFTER-${i + 1}.png`), imgBuffer);
        console.log(`   ✅ Saved direct-AFTER-${i + 1}.png`);
      }
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  
  console.log('\n✨ Done!');
}

main().catch(console.error);
