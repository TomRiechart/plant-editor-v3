import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results';

// Configure Fal.ai
fal.config({
  credentials: process.env.FAL_API_KEY,
});

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

async function main() {
  console.log('🌿 Direct Fal.ai Plant Editor\n');
  console.log('=' .repeat(50));
  
  const collectionPath = './data/uploads/collections/signature-six-full.jpg';
  const plantPath = './data/uploads/plants/anthurium-red.jpg';
  
  // Money Tree position (front left small plant in cream pot)
  const masks = [
    { x: 0.15, y: 0.78, radius: 0.07 }
  ];
  
  console.log('\n1️⃣ Creating masked image...');
  const maskedBuffer = await createMaskedImage(collectionPath, masks);
  
  fs.writeFileSync(path.join(OUTPUT_DIR, 'direct-masked.png'), maskedBuffer);
  console.log('   ✅ Saved masked preview');
  
  fs.copyFileSync(collectionPath, path.join(OUTPUT_DIR, 'direct-BEFORE.jpg'));
  console.log('   ✅ Saved before image');
  
  // Convert to data URLs
  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync(plantPath);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  const prompt = `You are an expert image-generation engine. Replace the plant inside the red circle with an Anthurium Red flowering plant.

CRITICAL RULES:
1. Replace ONLY the plant inside the red circle
2. Keep the exact same ceramic pot - do not change the pot at all
3. Maintain the same lighting, shadows, and perspective
4. The new plant should look natural in the environment
5. Do not change any other plants or elements in the image
6. Professional product photography quality`;

  console.log('\n2️⃣ Calling Fal.ai nano-banana-pro...');
  console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
  console.log('   ⏱️  This takes 2-3 minutes...\n');
  
  try {
    const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
      input: {
        prompt,
        image_urls: [canvasDataUrl, plantDataUrl],
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
    console.log(`   Generated ${images.length} images`);
    
    for (let i = 0; i < images.length; i++) {
      const imgUrl = images[i];
      console.log(`\n   Downloading image ${i + 1}...`);
      const imgResponse = await fetch(imgUrl);
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
      const outputPath = path.join(OUTPUT_DIR, `direct-AFTER-${i + 1}.png`);
      fs.writeFileSync(outputPath, imgBuffer);
      console.log(`   ✅ Saved: ${outputPath} (${Math.round(imgBuffer.length / 1024)}KB)`);
    }
    
    console.log('\n✨ Done! Results saved.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
