import { Router } from 'express';
import { generateWithFal } from '../services/fal.js';
import { getDb } from '../db.js';

const router = Router();

// Generate plant variations
router.post('/', async (req, res) => {
  try {
    const { canvasDataUrl, plants, mode } = req.body;

    if (!canvasDataUrl) {
      return res.status(400).json({ success: false, error: 'canvasDataUrl is required' });
    }

    if (!plants || !Array.isArray(plants) || plants.length === 0) {
      return res.status(400).json({ success: false, error: 'plants array is required' });
    }

    // Get system prompt from settings
    const db = getDb();
    const promptSetting = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('system_prompt') as any;
    const systemPrompt = promptSetting?.value || '';

    // Build the prompt based on mode
    let prompt = systemPrompt + '\n\n';

    if (mode === 'single') {
      const plant = plants[0];
      prompt += `Replace the object inside the red circle with a ${plant.name}.`;
    } else {
      // Multi-plant mode
      const colorMap: Record<string, string> = {
        red: 'RED',
        blue: 'BLUE',
        yellow: 'YELLOW',
      };

      prompt += 'Replace the plants in the following locations:\n';
      plants.forEach((plant, index) => {
        const colorName = colorMap[plant.color] || plant.color.toUpperCase();
        prompt += `- Replace the plant in the ${colorName} circle with the plant from input ${index + 2} (${plant.name}).\n`;
      });
      prompt += '\nDo not change the pots. Keep the original lighting and composition.';
    }

    console.log('Generating with prompt:', prompt);
    console.log('Plants:', plants.map(p => p.name).join(', '));

    // Prepare image URLs for Fal.ai
    const imageUrls = [
      canvasDataUrl, // Input 1: Canvas with masks
      ...plants.map(p => p.imageUrl), // Input 2+: Plant images
    ];

    // Call Fal.ai
    const result = await generateWithFal({
      prompt,
      imageUrls,
      numImages: 3,
      resolution: '4K',
    });

    res.json({ success: true, data: { images: result.images } });
  } catch (error) {
    console.error('Error generating:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to generate images' 
    });
  }
});

export default router;
