const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_DIR = 'C:\\Users\\User\\clawd\\projects\\plant-editor-v3\\data\\uploads';
const COLLECTIONS_DIR = path.join(BASE_DIR, 'collections');

const collections = [
  { slug: 'vibrant-valentines-2', name: 'Vibrant_Valentines' },
  { slug: 'love-spell-trio-1', name: 'Love_spell_trio' },
  { slug: 'cherished-duo', name: 'Cherished_duo' },
  { slug: 'harvest-harmony', name: 'Harvest_Harmony' },
  { slug: 'emerald-trinity', name: 'Emerald_Trinity' },
  { slug: 'natures-trifecta', name: 'Nature' }, // partial match
  { slug: 'heartfelt-harmony', name: 'Heartfelt_Harmony' },
  { slug: 'evergreen-ease', name: 'Evergreen' },
  { slug: 'the-radiant-trinity', name: 'Radiant_Trinity' },
  { slug: 'the-dazzling-duo', name: 'Dazzling_Duo' },
  { slug: 'the-fresh-starts', name: 'Fresh_Start' },
  { slug: 'favorable-five', name: 'Favorable_Five' },
  { slug: 'giving-roots', name: 'Giving_Roots' },
  { slug: 'new-beginnings-3', name: 'New_Beginnings' },
  { slug: 'the-treasured-stars-2', name: 'Treasured_Stars' },
  { slug: 'signature-six', name: 'Signature_Six' },
  { slug: 'woodsy-wonders-2', name: 'Woodsy_Wonders' },
  { slug: 'tropical-haven', name: 'Tropical_Haven' },
  { slug: 'statement-set', name: 'Statement_Set' },
  { slug: 'exotic-sanctuary', name: 'Exotic_Sanctuary' }
];

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    let actualUrl = url;
    const shopifyMatch = url.match(/https:\/\/cdn\.shopify\.com[^"'\s?]+/);
    if (shopifyMatch) actualUrl = shopifyMatch[0];
    
    https.get(actualUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(filepath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractCollectionImages(html, collectionName) {
  const images = new Set();
  // Use case-insensitive search for collection name
  const namePattern = collectionName.toLowerCase().replace(/_/g, '[_\\s-]?');
  const regex = new RegExp(`https://cdn\\.shopify\\.com/[^"'\\s]+(?:${namePattern})[^"'\\s]*(?:studio|home|see[_\\s-]?through)[^"'\\s]*\\.(?:jpg|jpeg|png)`, 'gi');
  const regex2 = new RegExp(`https://cdn\\.shopify\\.com/[^"'\\s]+(?:studio|home|see[_\\s-]?through)[^"'\\s]*(?:${namePattern})[^"'\\s]*\\.(?:jpg|jpeg|png)`, 'gi');
  
  [regex, regex2].forEach(r => {
    const matches = html.match(r) || [];
    matches.forEach(url => images.add(url.split('?')[0]));
  });
  
  // Also get Cloudinary wrapped URLs
  const cloudinaryRegex = /https:\/\/res\.cloudinary\.com\/easyplant\/[^"'\s]+/gi;
  const cloudMatches = html.match(cloudinaryRegex) || [];
  cloudMatches.forEach(url => {
    const lower = url.toLowerCase();
    if (lower.includes(collectionName.toLowerCase().replace(/_/g, '')) || 
        lower.includes(collectionName.toLowerCase().replace(/_/g, '-'))) {
      if (lower.includes('studio') || lower.includes('home') || lower.includes('see') && lower.includes('through')) {
        const shopifyMatch = url.match(/https:\/\/cdn\.shopify\.com[^"'\s?]+/);
        if (shopifyMatch) images.add(shopifyMatch[0].split('?')[0]);
      }
    }
  });
  
  return Array.from(images);
}

async function scrapeCollection(col) {
  const url = `https://easyplant.com/products/collections/${col.slug}`;
  console.log(`\n📦 ${col.slug}`);
  
  try {
    const html = await fetchPage(url);
    const images = extractCollectionImages(html, col.name);
    
    console.log(`   Found ${images.length} collection images`);
    
    let downloaded = 0;
    for (const imgUrl of images) {
      const basename = path.basename(imgUrl).split('?')[0];
      const filename = `${col.slug}_${basename}`;
      const filepath = path.join(COLLECTIONS_DIR, filename);
      
      if (fs.existsSync(filepath)) {
        console.log(`   ⏭️ Skip: ${basename}`);
        continue;
      }
      
      try {
        await downloadImage(imgUrl, filepath);
        downloaded++;
        console.log(`   ✅ ${basename}`);
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.log(`   ❌ ${basename}: ${err.message}`);
      }
    }
    
    return { slug: col.slug, found: images.length, downloaded };
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return { slug: col.slug, error: err.message };
  }
}

async function main() {
  console.log('🌱 Collections Image Scraper');
  console.log('============================\n');
  
  if (!fs.existsSync(COLLECTIONS_DIR)) fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
  
  const results = [];
  for (const col of collections) {
    results.push(await scrapeCollection(col));
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n\n📊 Summary:');
  console.log('===========');
  let total = 0;
  results.forEach(r => {
    if (r.error) {
      console.log(`❌ ${r.slug}: ${r.error}`);
    } else {
      console.log(`✅ ${r.slug}: ${r.downloaded}/${r.found}`);
      total += r.downloaded;
    }
  });
  console.log(`\n🎉 Total: ${total} images`);
}

main().catch(console.error);
