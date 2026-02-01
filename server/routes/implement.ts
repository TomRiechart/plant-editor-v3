import { Router } from 'express';
import { analyzeWithGemini, generatePromptWithGemini } from '../services/gemini.js';
import { generateWithFal } from '../services/fal.js';
import { getDb } from '../db.js';

const router = Router();

const STAGGER_DELAY_MS = 10000; // 10 seconds between parallel requests

// Helper to create SSE response
function createSSEResponse(res: any) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  return {
    send: (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    end: () => {
      res.end();
    },
  };
}

// Implement pipeline with SSE streaming
router.post('/', async (req, res) => {
  const sse = createSSEResponse(res);
  
  try {
    const { originalImageUrl, editedImageUrl, targetImages, plants, prompts } = req.body;

    if (!originalImageUrl || !editedImageUrl) {
      sse.send({ error: 'Original and edited image URLs are required' });
      return sse.end();
    }

    if (!targetImages || targetImages.length === 0) {
      sse.send({ error: 'At least one target image is required' });
      return sse.end();
    }

    // Get prompts from settings if not provided
    const db = getDb();
    const getPrompt = (key: string, override?: string) => {
      if (override) return override;
      const setting = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any;
      return setting?.value || '';
    };

    const analyzePrompt = getPrompt('implement_prompt_analyze', prompts?.analyze);
    const generatePromptTemplate = getPrompt('implement_prompt_generate', prompts?.generate);
    const applyPromptTemplate = getPrompt('implement_prompt_apply', prompts?.apply);

    sse.send({ step: 'analyzing', message: 'Starting analysis...' });

    // Keep-alive interval
    const keepAlive = setInterval(() => {
      sse.send({ keepAlive: true });
    }, 15000);

    try {
      // STEP 1: Analyze differences
      sse.send({ step: 'analyzing', message: 'Analyzing differences between original and edited images...' });
      
      const analysisResult = await analyzeWithGemini({
        prompt: analyzePrompt,
        images: [originalImageUrl, editedImageUrl],
      });

      sse.send({ 
        step: 'analyzing', 
        message: 'Analysis complete', 
        analysisResult 
      });

      // STEP 2.5: Generate custom prompts for each target image
      sse.send({ step: 'generating', message: 'Generating custom prompts for target images...' });

      const customPrompts: { targetId: string; prompt: string }[] = [];
      
      // Generate prompts in parallel with staggered start
      const promptPromises = targetImages.map(async (target: any, index: number) => {
        // Stagger the requests
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, index * 2000));
        }

        sse.send({ 
          step: 'generating', 
          message: `Generating prompt for image ${index + 1}/${targetImages.length}...`,
          imageIndex: index,
        });

        const customPrompt = await generatePromptWithGemini({
          promptTemplate: generatePromptTemplate,
          analysis: analysisResult,
          targetImageUrl: target.image_url,
          editedImageUrl,
        });

        return { targetId: target.id, prompt: customPrompt };
      });

      const promptResults = await Promise.all(promptPromises);
      customPrompts.push(...promptResults);

      sse.send({ 
        step: 'generating', 
        message: 'All prompts generated',
        customPrompts,
      });

      // STEP 3: Apply changes to each target image
      sse.send({ step: 'applying', message: 'Applying changes to target images...' });

      const results: any[] = [];

      // Process images with staggered parallel execution
      const applyPromises = customPrompts.map(async (promptData, index) => {
        // Stagger the requests to avoid rate limits
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, index * STAGGER_DELAY_MS));
        }

        const target = targetImages.find((t: any) => t.id === promptData.targetId);
        if (!target) return null;

        sse.send({ 
          step: 'applying', 
          message: `Processing image ${index + 1}/${customPrompts.length}...`,
          imageIndex: index,
          targetId: target.id,
        });

        try {
          // Build final prompt
          const finalPrompt = applyPromptTemplate.replace('{customPrompt}', promptData.prompt);

          // Prepare image URLs
          const imageUrls = [
            target.image_url, // Target image
            ...(plants?.map((p: any) => p.imageUrl) || []), // Plant reference images
          ];

          // Generate variations
          const result = await generateWithFal({
            prompt: finalPrompt,
            imageUrls,
            numImages: 3,
            resolution: '4K',
          });

          const imageResult = {
            targetId: target.id,
            targetImage: target,
            results: result.images,
            status: 'complete' as const,
          };

          sse.send({ 
            step: 'applying', 
            message: `Completed image ${index + 1}/${customPrompts.length}`,
            imageResult,
          });

          return imageResult;
        } catch (error) {
          const errorResult = {
            targetId: target.id,
            targetImage: target,
            results: [],
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          };

          sse.send({ 
            step: 'applying', 
            message: `Error processing image ${index + 1}`,
            imageResult: errorResult,
          });

          return errorResult;
        }
      });

      const applyResults = await Promise.all(applyPromises);
      results.push(...applyResults.filter(Boolean));

      // Complete
      sse.send({ 
        step: 'complete', 
        message: 'Implementation complete',
        results,
      });

      clearInterval(keepAlive);
      sse.end();

    } catch (error) {
      clearInterval(keepAlive);
      throw error;
    }

  } catch (error) {
    console.error('Error in implement pipeline:', error);
    sse.send({ 
      step: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    sse.end();
  }
});

export default router;
