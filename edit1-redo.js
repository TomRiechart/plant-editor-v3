import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results/final';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

async function main() {
  console.log('🔄 Redoing Edit 1: Money Tree → Anthurium Red\n');
  
  const imagePath = './data/uploads/collections/signature-six-full.jpg';
  const metadata = await sharp(imagePath).metadata();
  
  // Position for Money Tree - small cream pot front left
  const position = { x: 0.15, y: 0.78, radius: 0.055 };
  
  const x = Math.round(metadata.width * position.x);
  const y = Math.round(metadata.height * position.y);
  const r = Math.round(metadata.width * position.radius);
  
  console.log(`Mask: x=${x}, y=${y}, r=${r}`);
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">
    <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(239, 68, 68, 0.5)" />
  </svg>`;
  
  const maskedBuffer = await sharp(imagePath)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();

  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync('./data/uploads/plants/anthurium-red.jpg');
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  const prompt = `Replace the plant inside the red marked area with an Anthurium Red (a flowering plant with red heart-shaped flowers and dark green leaves).

The ceramic pot must remain EXACTLY the same:
- Small round cream/beige colored ceramic pot
- Same size, same round shape, same cream color
- Do NOT change the pot at all

Replace only the plant foliage and flowers. The Anthurium Red should have a few red heart-shaped flowers.
Professional product photography, maintain lighting and shadows.
IMPORTANT: Remove the red circle marker completely in the final result.`;

  console.log('Calling Fal.ai...');
  
  try {
    const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
      input: {
        prompt,
        image_urls: [canvasDataUrl, plantDataUrl],
        num_images: 3,
        resolution: '4K',
        output_format: 'png',
      },
      logs: false,
    });

    const images = result.images?.map(img => img.url) || [];
    console.log(`Generated ${images.length} variations`);
    
    for (let i = 0; i < images.length; i++) {
      const imgResponse = await fetch(images[i]);
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
      const outputPath = path.join(OUTPUT_DIR, `edit1-redo-${i + 1}.png`);
      fs.writeFileSync(outputPath, imgBuffer);
      console.log(`✅ Saved: ${outputPath}`);
    }
    
    console.log('\n✨ Done! Check results.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);
