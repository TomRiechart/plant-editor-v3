import 'dotenv/config';
import sharp from 'sharp';
import fs from 'fs';

console.log('🎨 Creating test with proper mask using sharp...\n');

async function runTest() {
  // Load original image and get dimensions
  const imagePath = './data/uploads/collections/living-room.jpg';
  const plantPath = './data/uploads/plants/money-tree.jpg';
  
  const metadata = await sharp(imagePath).metadata();
  console.log(`✅ Image dimensions: ${metadata.width}x${metadata.height}`);

  // Create a red circle SVG overlay
  // The snake plant in the white pot is approximately at x=170, y=580 (scaled to image size)
  // Let's target it with a circle
  const circleX = Math.round(metadata.width * 0.17); // ~17% from left
  const circleY = Math.round(metadata.height * 0.75); // ~75% from top
  const radius = Math.round(metadata.width * 0.08);   // ~8% of width
  
  console.log(`📍 Targeting area: x=${circleX}, y=${circleY}, radius=${radius}`);
  
  const circleSvg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <circle cx="${circleX}" cy="${circleY}" r="${radius}" 
              fill="rgba(239, 68, 68, 0.6)" />
    </svg>
  `;

  // Composite the circle onto the image
  const maskedBuffer = await sharp(imagePath)
    .composite([{
      input: Buffer.from(circleSvg),
      blend: 'over'
    }])
    .png()
    .toBuffer();

  // Save masked image for reference
  fs.writeFileSync('./data/uploads/collections/living-room-masked.png', maskedBuffer);
  console.log('✅ Saved masked image preview');

  // Convert to base64
  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;

  // Load plant image
  const plantBuffer = fs.readFileSync(plantPath);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;

  console.log('\n📤 Sending to Fal.ai with mask...');
  console.log('   Target: Snake Plant area (bottom left)');
  console.log('   Replacement: Money Tree');
  console.log('   This may take 2-3 minutes...\n');

  // Call the generate API
  const response = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canvasDataUrl,
      plants: [{
        name: 'Money Tree',
        imageUrl: plantDataUrl,
        color: 'red'
      }],
      mode: 'single'
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ Generation successful!');
    console.log(`📸 Generated ${result.data.images.length} variations\n`);
    
    // Download results
    for (let i = 0; i < result.data.images.length; i++) {
      const url = result.data.images[i];
      console.log(`Downloading variation ${i + 1}...`);
      
      try {
        const imgResponse = await fetch(url);
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
        fs.writeFileSync(`./data/uploads/results/masked-result-${i + 1}.png`, imgBuffer);
        console.log(`✅ Saved masked-result-${i + 1}.png (${Math.round(imgBuffer.length / 1024 / 1024)}MB)`);
      } catch (e) {
        console.log(`⚠️ Could not download: ${e.message}`);
      }
    }
    
    console.log('\n🎉 All done! Check the results folder.');
    return result.data.images;
  } else {
    console.log('❌ Generation failed:', result.error);
    return null;
  }
}

runTest().catch(console.error);
