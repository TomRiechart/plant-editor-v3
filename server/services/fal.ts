import * as fal from '@fal-ai/serverless-client';

// Configure Fal.ai client
fal.config({
  credentials: process.env.FAL_API_KEY,
});

interface GenerateOptions {
  prompt: string;
  imageUrls: string[];
  numImages?: number;
  resolution?: string;
}

interface FalResult {
  images: string[];
}

export async function generateWithFal(options: GenerateOptions): Promise<FalResult> {
  const { prompt, imageUrls, numImages = 3, resolution = '4K' } = options;

  console.log('🎨 Calling Fal.ai nano-banana-pro...');
  console.log('Prompt:', prompt.substring(0, 200) + '...');
  console.log('Image URLs:', imageUrls.length);

  try {
    const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
      input: {
        prompt,
        image_urls: imageUrls,
        num_images: numImages,
        resolution,
        output_format: 'png',
        aspect_ratio: 'auto',
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS' && update.logs) {
          update.logs.forEach((log) => console.log(`Fal.ai: ${log.message}`));
        }
      },
    });

    console.log('✅ Fal.ai generation complete');

    // Extract image URLs from result
    const images = (result as any).images?.map((img: any) => img.url) || [];

    if (images.length === 0) {
      throw new Error('No images returned from Fal.ai');
    }

    return { images };
  } catch (error) {
    console.error('❌ Fal.ai error:', error);
    throw error;
  }
}

// Helper to convert data URL to blob URL (if needed)
export async function uploadImageToFal(dataUrl: string): Promise<string> {
  // If it's already a URL (not data URL), return as is
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  // For data URLs, Fal.ai accepts them directly in most cases
  // But if we need to upload, we can use their storage API
  // For now, returning as-is since nano-banana-pro accepts data URLs
  return dataUrl;
}
