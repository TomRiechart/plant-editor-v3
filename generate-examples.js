import 'dotenv/config';
import sharp from 'sharp';
import fs from 'fs';

console.log('🎨 Generating multiple 4K examples...\n');

async function generateWithMask(targetX, targetY, radiusPercent, plantName, plantFile, outputPrefix) {
  const imagePath = './data/uploads/collections/living-room.jpg';
  const plantPath = `./data/uploads/plants/${plantFile}`;
  
  const metadata = await sharp(imagePath).metadata();
  
  const circleX = Math.round(metadata.width * targetX);
  const circleY = Math.round(metadata.height * targetY);
  const radius = Math.round(metadata.width * radiusPercent);
  
  console.log(`\n🎯 ${plantName} → position (${targetX*100}%, ${targetY*100}%)`);
  
  const circleSvg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <circle cx="${circleX}" cy="${circleY}" r="${radius}" 
              fill="rgba(239, 68, 68, 0.6)" />
    </svg>
  `;

  const maskedBuffer = await sharp(imagePath)
    .composite([{ input: Buffer.from(circleSvg), blend: 'over' }])
    .png()
    .toBuffer();

  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  const plantBuffer = fs.readFileSync(plantPath);
  const plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;

  console.log(`📤 Sending to Fal.ai (4K)...`);

  const response = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canvasDataUrl,
      plants: [{ name: plantName, imageUrl: plantDataUrl, color: 'red' }],
      mode: 'single'
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log(`✅ Generated 3 variations for ${plantName}`);
    
    // Download best result (first one)
    const url = result.data.images[0];
    const imgResponse = await fetch(url);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const outputPath = `./data/uploads/results/${outputPrefix}.png`;
    fs.writeFileSync(outputPath, imgBuffer);
    console.log(`💾 Saved: ${outputPath} (${Math.round(imgBuffer.length / 1024 / 1024)}MB)`);
    return outputPath;
  } else {
    console.log(`❌ Failed: ${result.error}`);
    return null;
  }
}

async function main() {
  const results = [];
  
  // Example 1: Replace Snake Plant (bottom left) with Money Tree
  console.log('\n═══════════════════════════════════════');
  console.log('Example 1: Snake Plant → Money Tree');
  console.log('═══════════════════════════════════════');
  const r1 = await generateWithMask(0.17, 0.78, 0.10, 'Money Tree', 'money-tree.jpg', 'example1-moneytree');
  if (r1) results.push(r1);
  
  // Example 2: Replace plant on coffee table with Calathea  
  console.log('\n═══════════════════════════════════════');
  console.log('Example 2: Coffee Table Plant → Calathea');
  console.log('═══════════════════════════════════════');
  const r2 = await generateWithMask(0.45, 0.55, 0.08, 'Calathea', 'calathea.jpg', 'example2-calathea');
  if (r2) results.push(r2);
  
  // Example 3: Replace Bird of Paradise (tall plant right side) with Cast Iron
  console.log('\n═══════════════════════════════════════');
  console.log('Example 3: Tall Plant → Cast Iron Plant');
  console.log('═══════════════════════════════════════');
  const r3 = await generateWithMask(0.62, 0.45, 0.12, 'Cast Iron Plant', 'cast-iron.jpg', 'example3-castiron');
  if (r3) results.push(r3);
  
  console.log('\n🎉 All examples generated!');
  console.log('Results:', results);
  return results;
}

main().catch(console.error);
