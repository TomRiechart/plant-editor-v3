import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

async function main() {
  console.log('🌿 Retry Edit D with stronger pot preservation\n');
  
  const imagePath = './data/uploads/collections/signature-six-full.jpg';
  const metadata = await sharp(imagePath).metadata();
  
  // Birds' Nest Fern position - right side, small cream pot
  const position = { x: 0.78, y: 0.76, radius: 0.07 };
  
  const x = Math.round(metadata.width * position.x);
  const y = Math.round(metadata.height * position.y);
  const r = Math.round(metadata.width * position.radius);
  
  console.log(`Mask: x=${x}, y=${y}, r=${r}`);
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">
    <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(239, 68, 68, 0.6)" />
  </svg>`;
  
  const maskedBuffer = await sharp(imagePath)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();

  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync('./data/uploads/plants/golden-snake.jpg');
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  // Much stronger emphasis on keeping the pot
  const prompt = `Replace ONLY the plant foliage inside the red circle with a Golden Snake Plant (Sansevieria with yellow-green striped vertical leaves).

EXTREMELY IMPORTANT - THE POT MUST NOT CHANGE:
- The pot is a small, round, cream/beige colored ceramic pot
- Keep the EXACT same pot - same size, same round shape, same cream color
- Only replace the green plant leaves, nothing else
- The pot must remain a small round cream pot
- Do not make the pot larger or change its shape to cylindrical

Professional product photography, maintain exact same lighting and shadows.`;

  console.log('Calling Fal.ai with stronger pot preservation prompt...');
  
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
      const outputPath = path.join(OUTPUT_DIR, `edit-D-retry-${i + 1}.png`);
      fs.writeFileSync(outputPath, imgBuffer);
      console.log(`✅ Saved: ${outputPath}`);
    }
    
    console.log('\n✨ Done! Check retry results.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);
