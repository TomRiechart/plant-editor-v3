const fs = require('fs');
const path = require('path');
const https = require('https');

// Collections URLs
const collections = [
  "https://easyplant.com/products/collections/vibrant-valentines-2",
  "https://easyplant.com/products/collections/love-spell-trio-1",
  "https://easyplant.com/products/collections/cherished-duo",
  "https://easyplant.com/products/collections/harvest-harmony",
  "https://easyplant.com/products/collections/emerald-trinity",
  "https://easyplant.com/products/collections/natures-trifecta",
  "https://easyplant.com/products/collections/heartfelt-harmony",
  "https://easyplant.com/products/collections/evergreen-ease",
  "https://easyplant.com/products/collections/the-radiant-trinity",
  "https://easyplant.com/products/collections/the-dazzling-duo",
  "https://easyplant.com/products/collections/the-fresh-starts",
  "https://easyplant.com/products/collections/favorable-five",
  "https://easyplant.com/products/collections/giving-roots",
  "https://easyplant.com/products/collections/new-beginnings-3",
  "https://easyplant.com/products/collections/the-treasured-stars-2",
  "https://easyplant.com/products/collections/signature-six",
  "https://easyplant.com/products/collections/woodsy-wonders-2",
  "https://easyplant.com/products/collections/tropical-haven",
  "https://easyplant.com/products/collections/statement-set",
  "https://easyplant.com/products/collections/exotic-sanctuary"
];

const BASE_DIR = 'C:\\Users\\User\\clawd\\projects\\plant-editor-v3\\data\\uploads';
const COLLECTIONS_DIR = path.join(BASE_DIR, 'collections');
const PLANTS_DIR = path.join(BASE_DIR, 'plants');

// Ensure directories exist
[COLLECTIONS_DIR, PLANTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Download image
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    // Handle protocol
    const protocol = url.startsWith('https') ? https : require('http');
    
    // Clean URL
    let cleanUrl = url;
    if (url.startsWith('//')) cleanUrl = 'https:' + url;
    
    const file = fs.createWriteStream(filepath);
    protocol.get(cleanUrl, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(filepath);
        return downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// Fetch page HTML
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Extract images from HTML
function extractImages(html, collectionName) {
  const images = [];
  
  // Find image URLs in the HTML (Shopify/Next.js style)
  const imgRegex = /https:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)[^"'\s]*/gi;
  const matches = html.match(imgRegex) || [];
  
  // Also look for srcset patterns
  const srcsetRegex = /srcset="([^"]+)"/gi;
  let match;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const urls = match[1].split(',').map(s => s.trim().split(' ')[0]);
    matches.push(...urls);
  }
  
  // Filter for product images (not logos, icons etc)
  const uniqueUrls = [...new Set(matches)].filter(url => 
    url.includes('cdn.shopify.com') && 
    !url.includes('logo') && 
    !url.includes('icon') &&
    (url.includes('products') || url.includes('files'))
  );
  
  return uniqueUrls;
}

async function scrapeCollection(url) {
  const collectionSlug = url.split('/').pop().replace(/-\d+$/, '');
  console.log(`\n📦 Scraping collection: ${collectionSlug}`);
  
  try {
    const html = await fetchPage(url);
    const images = extractImages(html, collectionSlug);
    
    console.log(`   Found ${images.length} images`);
    
    let downloaded = 0;
    for (let i = 0; i < images.length; i++) {
      const imgUrl = images[i];
      // Get largest version
      const largeUrl = imgUrl.replace(/\d+x\d+/, '1024x1024').replace('_small', '').replace('_thumb', '');
      
      const ext = path.extname(new URL(largeUrl).pathname).split('?')[0] || '.jpg';
      const filename = `${collectionSlug}_${i + 1}${ext}`;
      const filepath = path.join(COLLECTIONS_DIR, filename);
      
      if (fs.existsSync(filepath)) {
        console.log(`   ⏭️ Skip (exists): ${filename}`);
        continue;
      }
      
      try {
        await downloadImage(largeUrl, filepath);
        downloaded++;
        console.log(`   ✅ Downloaded: ${filename}`);
      } catch (err) {
        console.log(`   ❌ Failed: ${filename} - ${err.message}`);
      }
    }
    
    return { collection: collectionSlug, total: images.length, downloaded };
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return { collection: collectionSlug, error: err.message };
  }
}

async function main() {
  console.log('🌱 EasyPlant Image Scraper');
  console.log('==========================\n');
  
  const results = [];
  
  for (const url of collections) {
    const result = await scrapeCollection(url);
    results.push(result);
    await new Promise(r => setTimeout(r, 1000)); // Rate limit
  }
  
  console.log('\n\n📊 Summary:');
  console.log('===========');
  results.forEach(r => {
    if (r.error) {
      console.log(`❌ ${r.collection}: ERROR - ${r.error}`);
    } else {
      console.log(`✅ ${r.collection}: ${r.downloaded}/${r.total} images`);
    }
  });
}

main().catch(console.error);
