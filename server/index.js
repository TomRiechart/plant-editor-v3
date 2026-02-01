import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as fal from '@fal-ai/serverless-client';
import sharp from 'sharp';
import cookieParser from 'cookie-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const PIN_CODE = process.env.PIN_CODE || '6262';

// Configure Fal.ai
fal.config({ credentials: process.env.FAL_API_KEY });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// PIN Authentication middleware
const loginPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plant Editor - Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    h1 { color: #4ade80; margin-bottom: 10px; font-size: 28px; }
    p { color: #94a3b8; margin-bottom: 30px; }
    .pin-input {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 20px;
    }
    .pin-input input {
      width: 50px;
      height: 60px;
      text-align: center;
      font-size: 24px;
      border: 2px solid #4ade80;
      border-radius: 10px;
      background: rgba(0,0,0,0.3);
      color: white;
      outline: none;
    }
    .pin-input input:focus { border-color: #22c55e; box-shadow: 0 0 10px rgba(74,222,128,0.5); }
    button {
      background: #4ade80;
      color: #1a1a2e;
      border: none;
      padding: 15px 40px;
      font-size: 16px;
      font-weight: bold;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s;
    }
    button:hover { background: #22c55e; transform: scale(1.05); }
    .error { color: #ef4444; margin-top: 15px; display: none; }
    .error.show { display: block; }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>🌿 Plant Editor</h1>
    <p>Enter PIN to continue</p>
    <form method="POST" action="/auth/login">
      <div class="pin-input">
        <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" name="p1" autofocus>
        <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" name="p2">
        <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" name="p3">
        <input type="text" maxlength="1" pattern="[0-9]" inputmode="numeric" name="p4">
      </div>
      <input type="hidden" name="pin" id="pin">
      <button type="submit">Enter</button>
    </form>
    <p class="error" id="error">Wrong PIN. Try again.</p>
  </div>
  <script>
    const inputs = document.querySelectorAll('.pin-input input');
    const pinField = document.getElementById('pin');
    inputs.forEach((input, i) => {
      input.addEventListener('input', () => {
        if (input.value && i < inputs.length - 1) inputs[i + 1].focus();
        pinField.value = Array.from(inputs).map(i => i.value).join('');
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) inputs[i - 1].focus();
      });
    });
    if (location.search.includes('error=1')) document.getElementById('error').classList.add('show');
  </script>
</body>
</html>
`;

function requireAuth(req, res, next) {
  // Allow auth routes
  if (req.path.startsWith('/auth/')) return next();
  
  // Check cookie
  if (req.cookies.plant_auth === 'verified') return next();
  
  // Not authenticated - show login
  res.send(loginPage);
}

// Auth routes (before auth middleware)
app.post('/auth/login', (req, res) => {
  const pin = req.body.pin || (req.body.p1 + req.body.p2 + req.body.p3 + req.body.p4);
  if (pin === PIN_CODE) {
    res.cookie('plant_auth', 'verified', { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    res.redirect('/');
  } else {
    res.redirect('/auth/login?error=1');
  }
});

app.get('/auth/login', (req, res) => {
  res.send(loginPage);
});

app.get('/auth/logout', (req, res) => {
  res.clearCookie('plant_auth');
  res.redirect('/');
});

// Apply auth middleware to all routes
app.use(requireAuth);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));
app.use('/results', express.static(path.join(__dirname, '../data/uploads/results')));

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../data/uploads/collections');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `upload-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Store active jobs for progress tracking
const activeJobs = new Map();

// Default prompt template
const DEFAULT_PROMPT = `Replace ONLY the plant foliage inside the red marked area with {{PLANT_NAME}}.

CRITICAL REQUIREMENTS:
- The {{POT_COLOR}} pot MUST remain EXACTLY unchanged
- Same pot color, shape, size, and position
- Do NOT modify anything outside the red ellipse
- Remove the red marker in the final image
- Keep the same lighting and style`;

// ============ API ROUTES ============

// Get available plants
app.get('/api/plants', (req, res) => {
  const plantsDir = path.join(__dirname, '../data/uploads/plants');
  if (!fs.existsSync(plantsDir)) {
    return res.json([]);
  }
  const plants = fs.readdirSync(plantsDir)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .map(f => ({
      id: f.replace(/\.[^.]+$/, ''),
      name: f.replace(/\.[^.]+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      image: `/uploads/plants/${f}`
    }));
  res.json(plants);
});

// Collections config file
const collectionsConfigFile = path.join(__dirname, '../data/collections-config.json');

function loadCollectionsConfig() {
  try {
    if (fs.existsSync(collectionsConfigFile)) {
      return JSON.parse(fs.readFileSync(collectionsConfigFile, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load collections config:', e);
  }
  return {};
}

function saveCollectionsConfig(config) {
  fs.writeFileSync(collectionsConfigFile, JSON.stringify(config, null, 2));
}

// Get collections config
app.get('/api/collections/config', (req, res) => {
  res.json(loadCollectionsConfig());
});

// Save collections config
app.post('/api/collections/config', (req, res) => {
  try {
    saveCollectionsConfig(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all collections (grouped from filenames)
app.get('/api/collections', (req, res) => {
  const collectionsDir = path.join(__dirname, '../data/uploads/collections');
  if (!fs.existsSync(collectionsDir)) {
    return res.json([]);
  }
  
  const files = fs.readdirSync(collectionsDir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  
  const config = loadCollectionsConfig();
  
  // Group by collection name (prefix before first underscore)
  const collectionsMap = new Map();
  
  files.forEach(filename => {
    // Extract collection name from filename (e.g., "cherished-duo_..." -> "cherished-duo")
    const parts = filename.split('_');
    const collectionId = parts[0] || 'misc';
    
    if (!collectionsMap.has(collectionId)) {
      collectionsMap.set(collectionId, {
        id: collectionId,
        name: collectionId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        images: [],
        thumbnail: null
      });
    }
    
    const collection = collectionsMap.get(collectionId);
    const imageUrl = `/uploads/collections/${filename}`;
    collection.images.push({
      id: filename,
      url: imageUrl,
      filename: filename
    });
  });
  
  // Apply saved config (order and main image)
  const collections = Array.from(collectionsMap.values()).map(col => {
    const colConfig = config[col.id];
    
    if (colConfig) {
      // Sort by saved order
      if (colConfig.order && colConfig.order.length > 0) {
        col.images.sort((a, b) => {
          const aIdx = colConfig.order.indexOf(a.filename);
          const bIdx = colConfig.order.indexOf(b.filename);
          return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });
      }
      
      // Set main image as thumbnail
      if (colConfig.main) {
        const mainImg = col.images.find(img => img.filename === colConfig.main);
        if (mainImg) {
          col.thumbnail = mainImg.url;
        }
      }
    }
    
    // Default thumbnail to first image
    if (!col.thumbnail && col.images.length > 0) {
      col.thumbnail = col.images[0].url;
    }
    
    return col;
  });
  
  res.json(collections);
});

// Get single collection
app.get('/api/collections/:id', (req, res) => {
  const collectionsDir = path.join(__dirname, '../data/uploads/collections');
  const collectionId = req.params.id;
  
  if (!fs.existsSync(collectionsDir)) {
    return res.status(404).json({ error: 'Collection not found' });
  }
  
  // First try: files with prefix pattern (e.g., "cherished-duo_...")
  let files = fs.readdirSync(collectionsDir)
    .filter(f => f.startsWith(collectionId + '_') && /\.(jpg|jpeg|png|webp)$/i.test(f));
  
  // Second try: single file where the collectionId IS the filename (without extension)
  if (files.length === 0) {
    const allFiles = fs.readdirSync(collectionsDir);
    // Check if there's a file that matches the collectionId (with any image extension)
    const singleFile = allFiles.find(f => {
      const nameWithoutExt = f.replace(/\.(jpg|jpeg|png|webp)$/i, '');
      return nameWithoutExt === collectionId || f === collectionId;
    });
    if (singleFile) {
      files = [singleFile];
    }
  }
  
  if (files.length === 0) {
    return res.status(404).json({ error: 'Collection not found' });
  }
  
  const config = loadCollectionsConfig();
  const colConfig = config[collectionId];
  
  let images = files.map(filename => ({
    id: filename,
    url: `/uploads/collections/${filename}`,
    filename: filename,
    is_main: false
  }));
  
  // Apply saved config
  if (colConfig) {
    // Sort by saved order
    if (colConfig.order && colConfig.order.length > 0) {
      images.sort((a, b) => {
        const aIdx = colConfig.order.indexOf(a.filename);
        const bIdx = colConfig.order.indexOf(b.filename);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    }
    
    // Mark main image
    if (colConfig.main) {
      images = images.map(img => ({
        ...img,
        is_main: img.filename === colConfig.main
      }));
    }
  }
  
  // Default first as main if none set
  if (!images.some(img => img.is_main) && images.length > 0) {
    images[0].is_main = true;
  }
  
  const collection = {
    id: collectionId,
    name: collectionId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    images: images
  };
  
  res.json(collection);
});

// Get default prompt
app.get('/api/prompt', (req, res) => {
  res.json({ prompt: DEFAULT_PROMPT });
});

// Upload collection image
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: `/uploads/collections/${req.file.filename}`
  });
});

// Start plant replacement job
app.post('/api/replace', async (req, res) => {
  const { imageFile, edits, customPrompt } = req.body;
  
  if (!imageFile || !edits || edits.length === 0) {
    return res.status(400).json({ error: 'Missing imageFile or edits' });
  }

  const jobId = `job-${Date.now()}`;
  const outputDir = path.join(__dirname, `../data/uploads/results/${jobId}`);
  fs.mkdirSync(outputDir, { recursive: true });

  // Initialize job status
  activeJobs.set(jobId, {
    status: 'running',
    progress: 0,
    totalSteps: edits.length,
    currentStep: 0,
    currentAttempt: 0,
    results: [],
    liveVersions: [],  // Real-time versions as they're generated
    pendingSelection: false,  // Waiting for user to select
    selectedVersion: null,
    logs: [],
    originalImage: `/uploads/collections/${imageFile}`
  });

  res.json({ jobId, status: 'started' });

  // Process in background
  processJob(jobId, imageFile, edits, customPrompt || DEFAULT_PROMPT, outputDir);
});

// Get job status
app.get('/api/job/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Cancel job
app.post('/api/job/:jobId/cancel', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  job.cancelled = true;
  job.status = 'cancelled';
  job.logs.push({ time: new Date(), msg: '🛑 Job cancelled by user' });
  res.json({ success: true, message: 'Job cancelled' });
});

// Select a specific version to use
app.post('/api/job/:jobId/select', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const { versionId } = req.body;
  if (!versionId) {
    return res.status(400).json({ error: 'versionId required' });
  }
  job.selectedVersion = versionId;
  job.pendingSelection = false;
  job.logs.push({ time: new Date(), msg: `👆 User selected version ${versionId}` });
  res.json({ success: true, message: `Selected version ${versionId}` });
});

// ============ PROCESSING LOGIC ============

const MAX_RETRIES = 10;

async function processJob(jobId, imageFile, edits, promptTemplate, outputDir) {
  const job = activeJobs.get(jobId);
  const imagePath = path.join(__dirname, '../data/uploads/collections', imageFile);
  
  try {
    let currentImage = fs.readFileSync(imagePath);
    const originalImage = currentImage; // Keep original for comparison
    fs.copyFileSync(imagePath, path.join(outputDir, 'ORIGINAL.jpg'));
    
    job.logs.push({ time: new Date(), msg: '🚀 Starting plant replacement...' });
    job.logs.push({ time: new Date(), msg: `📋 ${edits.length} plants to replace (max ${MAX_RETRIES} retries each)` });

    for (let i = 0; i < edits.length; i++) {
      // Check for cancellation
      if (job.cancelled) {
        job.logs.push({ time: new Date(), msg: '🛑 Job stopped' });
        return;
      }
      
      const edit = edits[i];
      job.currentStep = i + 1;
      job.progress = Math.round((i / edits.length) * 100);
      job.logs.push({ time: new Date(), msg: `\n🌱 Step ${i + 1}/${edits.length}: ${edit.original} → ${edit.replacement}` });

      const result = await processEditWithRetry(
        currentImage, 
        originalImage,
        edit, 
        promptTemplate,
        outputDir, 
        i + 1, 
        job
      );
      
      if (result.success) {
        // SUCCESS: Use the verified image as base for next edit
        currentImage = result.verifiedBuffer;
        job.results.push({
          step: i + 1,
          edit: edit,
          versions: result.allVersions,
          attempts: result.attempts,
          finalVersion: result.finalVersion
        });
        job.logs.push({ time: new Date(), msg: `✅ Step ${i + 1} completed after ${result.attempts} attempt(s)` });
      } else {
        // FAILED after all retries
        job.logs.push({ time: new Date(), msg: `❌ Step ${i + 1} FAILED after ${MAX_RETRIES} attempts - skipping` });
        job.results.push({
          step: i + 1,
          edit: edit,
          versions: result.allVersions,
          attempts: result.attempts,
          failed: true
        });
      }
    }

    // Save final
    const finalPath = path.join(outputDir, 'FINAL.jpg');
    await sharp(currentImage).jpeg({ quality: 95 }).toFile(finalPath);
    
    job.status = 'completed';
    job.progress = 100;
    job.logs.push({ time: new Date(), msg: '\n🎉 All done!' });
    job.finalImage = `/results/${jobId}/FINAL.jpg`;

  } catch (error) {
    job.status = 'error';
    job.error = error.message;
    job.logs.push({ time: new Date(), msg: `❌ Error: ${error.message}` });
    console.error('Job error:', error);
  }
}

async function processEditWithRetry(currentImage, originalImage, edit, promptTemplate, outputDir, stepNum, job) {
  const allVersions = [];
  let verifiedBuffer = null;
  let finalVersion = null;
  let attempts = 0;

  // Clear live versions for this step
  job.liveVersions = [];
  job.selectedVersion = null;

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    // Check for cancellation between retries
    if (job.cancelled) {
      return { success: false, verifiedBuffer: null, finalVersion: null, allVersions, attempts, cancelled: true };
    }
    
    attempts = retry + 1;
    job.currentAttempt = attempts;
    job.logs.push({ time: new Date(), msg: `   🔄 Attempt ${attempts}/${MAX_RETRIES}...` });

    try {
      const result = await generateVersions(currentImage, edit, promptTemplate, outputDir, stepNum, attempts, job);
      
      // Check each version for pot verification and add to live display
      for (const version of result.versions) {
        allVersions.push(version);
        
        // Add to live versions immediately for real-time display
        job.liveVersions.push({
          ...version,
          step: stepNum,
          edit: { original: edit.original, replacement: edit.replacement }
        });
        
        if (version.passed && !verifiedBuffer) {
          // Found a passing version!
          verifiedBuffer = version.buffer;
          finalVersion = version;
          job.logs.push({ time: new Date(), msg: `   ✅ Version ${version.version} PASSED (${(version.similarity * 100).toFixed(1)}% pot match)` });
        } else if (!version.passed) {
          job.logs.push({ time: new Date(), msg: `   ⚠️ Version ${version.version} failed (${(version.similarity * 100).toFixed(1)}% pot match)` });
        }
      }

      // If user selected a version manually, use that
      if (job.selectedVersion) {
        const selected = allVersions.find(v => v.version === job.selectedVersion);
        if (selected) {
          job.logs.push({ time: new Date(), msg: `   👆 Using user-selected version ${job.selectedVersion}` });
          return {
            success: true,
            verifiedBuffer: selected.buffer,
            finalVersion: selected,
            allVersions,
            attempts
          };
        }
      }

      if (verifiedBuffer) {
        // Success! Return the verified version
        return {
          success: true,
          verifiedBuffer,
          finalVersion,
          allVersions,
          attempts
        };
      }

      job.logs.push({ time: new Date(), msg: `   ❌ No version passed verification, retrying...` });

    } catch (error) {
      job.logs.push({ time: new Date(), msg: `   ⚠️ Attempt ${attempts} error: ${error.message}` });
    }
  }

  // All retries exhausted - check if user wants to select one anyway
  job.pendingSelection = true;
  job.logs.push({ time: new Date(), msg: `   ⏸️ No version passed. You can select one manually or it will skip.` });
  
  // Quick check for user selection (3 seconds max, not 30)
  for (let wait = 0; wait < 3; wait++) {
    if (job.selectedVersion || job.cancelled) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  job.pendingSelection = false;
  
  if (job.selectedVersion) {
    const selected = allVersions.find(v => v.version === job.selectedVersion);
    if (selected) {
      job.logs.push({ time: new Date(), msg: `   👆 Using user-selected version ${job.selectedVersion}` });
      return {
        success: true,
        verifiedBuffer: selected.buffer,
        finalVersion: selected,
        allVersions,
        attempts
      };
    }
  }

  // Really failed
  return {
    success: false,
    verifiedBuffer: null,
    finalVersion: null,
    allVersions,
    attempts
  };
}

async function generateVersions(imageBuffer, edit, promptTemplate, outputDir, stepNum, attemptNum, job) {
  const metadata = await sharp(imageBuffer).metadata();
  const mask = edit.foliageMask;
  
  // Create visual mask
  const cx = Math.round(metadata.width * mask.cx);
  const cy = Math.round(metadata.height * mask.cy);
  const rx = Math.round(metadata.width * mask.rx);
  const ry = Math.round(metadata.height * mask.ry);
  
  const svg = `<svg width="${metadata.width}" height="${metadata.height}">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(239, 68, 68, 0.5)"/>
  </svg>`;
  
  const maskedBuffer = await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();

  const canvasDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
  
  // Load plant reference if available
  let plantDataUrl = null;
  if (edit.plantFile) {
    const plantPath = path.join(__dirname, '../data/uploads/plants', edit.plantFile);
    if (fs.existsSync(plantPath)) {
      const plantBuffer = fs.readFileSync(plantPath);
      plantDataUrl = `data:image/jpeg;base64,${plantBuffer.toString('base64')}`;
    }
  }

  // Build prompt from template
  const prompt = promptTemplate
    .replace(/\{\{PLANT_NAME\}\}/g, edit.replacement)
    .replace(/\{\{POT_COLOR\}\}/g, edit.potColor || 'ceramic');

  const imageUrls = plantDataUrl ? [canvasDataUrl, plantDataUrl] : [canvasDataUrl];
  
  // Always generate 3 versions
  const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
    input: {
      prompt,
      image_urls: imageUrls,
      num_images: 3,
      resolution: '4K',
      output_format: 'png',
    },
    logs: false,
  });

  const images = result.images || [];
  const versions = [];

  for (let i = 0; i < images.length; i++) {
    const imgResponse = await fetch(images[i].url);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    
    // Verify that area OUTSIDE the mask stayed the same (pot + background)
    const similarity = await compareOutsideMask(imageBuffer, imgBuffer, edit.foliageMask);
    const passed = similarity >= 0.92; // 92% threshold for outside area
    
    const versionLabel = `${attemptNum}${String.fromCharCode(65 + i)}`;
    const filename = `step${stepNum}-v${versionLabel}-${edit.replacement.replace(/ /g, '-')}.png`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, imgBuffer);
    
    // Compress for potential use as next base
    const compressedBuffer = await sharp(imgBuffer)
      .resize(2400, null, { withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    versions.push({
      version: versionLabel,
      filename,
      path: `/results/${path.basename(outputDir)}/${filename}`,
      similarity,
      passed,
      buffer: compressedBuffer
    });
  }

  return { versions };
}

// Compare pixels OUTSIDE the foliage mask (ellipse)
// This ensures pot and background stay unchanged
async function compareOutsideMask(original, result, foliageMask) {
  if (!foliageMask) return 1; // Skip if no mask defined
  
  try {
    // Resize both images to manageable size for comparison
    const targetWidth = 400;
    
    const origMeta = await sharp(original).metadata();
    const scale = targetWidth / origMeta.width;
    const targetHeight = Math.round(origMeta.height * scale);
    
    // Get raw pixel data from both images
    const origData = await sharp(original)
      .resize(targetWidth, targetHeight)
      .raw()
      .toBuffer();
    
    const resData = await sharp(result)
      .resize(targetWidth, targetHeight)
      .raw()
      .toBuffer();
    
    if (origData.length !== resData.length) return 0;
    
    // Calculate ellipse parameters in scaled coordinates
    const cx = foliageMask.cx * targetWidth;
    const cy = foliageMask.cy * targetHeight;
    const rx = foliageMask.rx * targetWidth;
    const ry = foliageMask.ry * targetHeight;
    
    // Compare only pixels OUTSIDE the ellipse
    let totalDiff = 0;
    let pixelsCompared = 0;
    const channels = 3; // RGB
    
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        // Check if pixel is OUTSIDE the ellipse
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const isOutside = (dx * dx + dy * dy) > 1;
        
        if (isOutside) {
          const idx = (y * targetWidth + x) * channels;
          for (let c = 0; c < channels; c++) {
            totalDiff += Math.abs(origData[idx + c] - resData[idx + c]);
          }
          pixelsCompared += channels;
        }
      }
    }
    
    if (pixelsCompared === 0) return 1; // No pixels to compare
    
    // Return similarity (1 = identical, 0 = completely different)
    const avgDiff = totalDiff / pixelsCompared / 255;
    return 1 - avgDiff;
    
  } catch (err) {
    console.error('Outside mask comparison error:', err);
    return 0;
  }
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Start server
app.listen(PORT, () => {
  console.log(`🌿 Plant Editor running at http://localhost:${PORT}`);
});
