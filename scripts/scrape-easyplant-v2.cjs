const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_DIR = 'C:\\Users\\User\\clawd\\projects\\plant-editor-v3\\data\\uploads';
const COLLECTIONS_DIR = path.join(BASE_DIR, 'collections');
const PLANTS_DIR = path.join(BASE_DIR, 'plants');

// Collections data structure
const collections = [
  { slug: 'vibrant-valentines-2', name: 'vibrant-valentines' },
  { slug: 'love-spell-trio-1', name: 'love-spell-trio' },
  { slug: 'cherished-duo', name: 'cherished-duo' },
  { slug: 'harvest-harmony', name: 'harvest-harmony' },
  { slug: 'emerald-trinity', name: 'emerald-trinity' },
  { slug: 'natures-trifecta', name: 'natures-trifecta' },
  { slug: 'heartfelt-harmony', name: 'heartfelt-harmony' },
  { slug: 'evergreen-ease', name: 'evergreen-ease' },
  { slug: 'the-radiant-trinity', name: 'radiant-trinity' },
  { slug: 'the-dazzling-duo', name: 'dazzling-duo' },
  { slug: 'the-fresh-starts', name: 'fresh-starts' },
  { slug: 'favorable-five', name: 'favorable-five' },
  { slug: 'giving-roots', name: 'giving-roots' },
  { slug: 'new-beginnings-3', name: 'new-beginnings' },
  { slug: 'the-treasured-stars-2', name: 'treasured-stars' },
  { slug: 'signature-six', name: 'signature-six' },
  { slug: 'woodsy-wonders-2', name: 'woodsy-wonders' },
  { slug: 'tropical-haven', name: 'tropical-haven' },
  { slug: 'statement-set', name: 'statement-set' },
  { slug: 'exotic-sanctuary', name: 'exotic-sanctuary' }
];

// Download image with proper handling
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    // Extract the actual Shopify URL from Cloudinary wrapper
    let actualUrl = url;
    const shopifyMatch = url.match(/https:\/\/cdn\.shopify\.com[^?]+/);
    if (shopifyMatch) {
      actualUrl = shopifyMatch[0];
    }
    
    const protocol = actualUrl.startsWith('https') ? https : http;
    
    const request = protocol.get(actualUrl, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
        return downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(filepath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
      file.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    });
    
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Fetch page with better headers
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    };
    
    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Extract relevant images from HTML - only studio, home, see_through
function extractProductImages(html) {
  const images = new Set();
  
  // Match all image URLs
  const patterns = [
    /https:\/\/cdn\.shopify\.com\/s\/files\/[^"'\s]+(?:studio|home|See_[tT]hrough|see_through)[^"'\s]*\.(?:jpg|jpeg|png)/gi,
    /https:\/\/res\.cloudinary\.com\/easyplant\/[^"'\s]+(?:studio|home|See_[tT]hrough|see_through)[^"'\s]*/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = html.match(pattern) || [];
    matches.forEach(url => {
      // Extract Shopify URL if wrapped in Cloudinary
      const shopifyMatch = url.match(/https:\/\/cdn\.shopify\.com[^"'\s?]+/);
      if (shopifyMatch) {
        images.add(shopifyMatch[0]);
      } else {
        images.add(url);
      }
    });
  });
  
  return Array.from(images);
}

// Sanitize filename
function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

// Extract filename from URL
function getFilename(url, collectionName) {
  const urlPath = new URL(url).pathname;
  const basename = path.basename(urlPath);
  // Remove query strings and clean up
  return basename.split('?')[0];
}

async function scrapeCollection(collection) {
  const url = `https://easyplant.com/products/collections/${collection.slug}`;
  console.log(`\n📦 ${collection.name}`);
  
  try {
    const html = await fetchPage(url);
    const images = extractProductImages(html);
    
    console.log(`   Found ${images.length} product images`);
    
    let downloaded = 0;
    let skipped = 0;
    
    for (const imgUrl of images) {
      const filename = getFilename(imgUrl, collection.name);
      const filepath = path.join(COLLECTIONS_DIR, filename);
      
      if (fs.existsSync(filepath)) {
        skipped++;
        continue;
      }
      
      try {
        await downloadImage(imgUrl, filepath);
        downloaded++;
        const shortName = filename.length > 50 ? filename.substring(0, 47) + '...' : filename;
        console.log(`   ✅ ${shortName}`);
        await new Promise(r => setTimeout(r, 200)); // Small delay
      } catch (err) {
        console.log(`   ❌ ${filename}: ${err.message}`);
      }
    }
    
    if (skipped > 0) console.log(`   ⏭️ Skipped ${skipped} existing`);
    
    return { name: collection.name, found: images.length, downloaded, skipped };
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return { name: collection.name, error: err.message };
  }
}

async function main() {
  console.log('🌱 EasyPlant Image Scraper v2');
  console.log('==============================');
  console.log('Downloading: studio, home, see-through images only\n');
  
  // Ensure directories exist
  [COLLECTIONS_DIR, PLANTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  
  const results = [];
  
  for (const collection of collections) {
    const result = await scrapeCollection(collection);
    results.push(result);
    await new Promise(r => setTimeout(r, 1000)); // Rate limit between collections
  }
  
  console.log('\n\n📊 Summary:');
  console.log('===========');
  let totalDownloaded = 0;
  let totalFound = 0;
  
  results.forEach(r => {
    if (r.error) {
      console.log(`❌ ${r.name}: ERROR - ${r.error}`);
    } else {
      console.log(`✅ ${r.name}: ${r.downloaded} new (${r.found} total)`);
      totalDownloaded += r.downloaded;
      totalFound += r.found;
    }
  });
  
  console.log(`\n🎉 Total: ${totalDownloaded} images downloaded`);
}

main().catch(console.error);
