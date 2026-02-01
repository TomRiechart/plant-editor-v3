import 'dotenv/config';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = './data/uploads/results/final';

fal.config({
  credentials: process.env.FAL_API_KEY,
});

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Planned replacements - matched by size
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

async function createMaskedImage(imagePath, position) {
  const metadata = await sharp(imagePath).metadata();
  
  const x = Math.round(metadata.width * position.x);
  const y = Math.round(metadata.height * position.y);
  const r = Math.round(metadata.width * position.radius);
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">
    <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(239, 68, 68, 0.6)" />
  </svg>`;
  
  return await sharp(imagePath)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
}

async function runSingleEdit(edit) {
  console.log(`\n🌱 Edit ${edit.id}: ${edit.original} → ${edit.replacement}`);
  
  const imagePath = './data/uploads/collections/signature-six-full.jpg';
  const maskedBuffer = await createMaskedImage(imagePath, edit.position);
  
  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync(`./data/uploads/plants/${edit.plantFile}`);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
  
  const prompt = `Replace ONLY the plant foliage inside the red circle with a ${edit.replacement}.

CRITICAL POT PRESERVATION RULES:
- The pot is a ${edit.potDesc}
- Keep the EXACT same pot - identical size, shape, and color
- Do NOT change the pot in any way
- Only replace the plant leaves/foliage, keep the pot exactly as is
- The pot must look identical to the original

The ${edit.replacement} should be similar in size and proportion to the original ${edit.original}.
Professional product photography, clean background, natural lighting.`;

  console.log('   Calling Fal.ai...');
  
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
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    
    const outputPath = path.join(OUTPUT_DIR, `edit${edit.id}-${edit.replacement.replace(/ /g,'-')}.png`);
    fs.writeFileSync(outputPath, imgBuffer);
    console.log(`   ✅ Saved: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🌿 Final Plant Collection Edit');
  console.log('=' .repeat(50));
  console.log('Replacing 4 plants with size-matched alternatives\n');
  
  // Copy original
  fs.copyFileSync('./data/uploads/collections/signature-six-full.jpg', 
                  path.join(OUTPUT_DIR, 'ORIGINAL.jpg'));
  console.log('✅ Saved original for comparison');
  
  const results = [];
  
  for (const edit of EDITS) {
    const result = await runSingleEdit(edit);
    if (result) {
      results.push({ edit, path: result });
    }
    // Delay between API calls
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`✨ Completed ${results.length} of ${EDITS.length} edits`);
  console.log(`📁 Results in: ${OUTPUT_DIR}`);
}

main().catch(console.error);
