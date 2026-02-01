import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

interface AnalyzeOptions {
  prompt: string;
  images: string[];
}

interface GeneratePromptOptions {
  promptTemplate: string;
  analysis: string;
  targetImageUrl: string;
  editedImageUrl: string;
}

// Convert image URL or data URL to Gemini format
async function prepareImageForGemini(url: string): Promise<{ inlineData: { data: string; mimeType: string } }> {
  // If it's a data URL
  if (url.startsWith('data:')) {
    const matches = url.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
      return {
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      };
    }
    throw new Error('Invalid data URL format');
  }

  // If it's a regular URL, fetch and convert
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = response.headers.get('content-type') || 'image/jpeg';

  return {
    inlineData: {
      mimeType,
      data: base64,
    },
  };
}

export async function analyzeWithGemini(options: AnalyzeOptions): Promise<string> {
  const { prompt, images } = options;

  console.log('🔍 Calling Gemini for analysis...');

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // Prepare images
    const imageParts = await Promise.all(images.map(prepareImageForGemini));

    // Create content array
    const content = [
      prompt,
      'Image 1 (Original):',
      imageParts[0],
      'Image 2 (Edited):',
      imageParts[1],
    ];

    const result = await model.generateContent(content);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini analysis complete');
    console.log('Analysis:', text.substring(0, 200) + '...');

    return text;
  } catch (error) {
    console.error('❌ Gemini analysis error:', error);
    throw error;
  }
}

export async function generatePromptWithGemini(options: GeneratePromptOptions): Promise<string> {
  const { promptTemplate, analysis, targetImageUrl, editedImageUrl } = options;

  console.log('📝 Calling Gemini for prompt generation...');

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // Replace placeholder in template
    const prompt = promptTemplate.replace('{analysis}', analysis);

    // Prepare images
    const targetImage = await prepareImageForGemini(targetImageUrl);
    const editedImage = await prepareImageForGemini(editedImageUrl);

    // Create content array
    const content = [
      prompt,
      'Target image (to be edited):',
      targetImage,
      'Reference edited image (example of desired changes):',
      editedImage,
    ];

    const result = await model.generateContent(content);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini prompt generation complete');
    console.log('Generated prompt:', text.substring(0, 200) + '...');

    return text;
  } catch (error) {
    console.error('❌ Gemini prompt generation error:', error);
    throw error;
  }
}
