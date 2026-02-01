// Collection types
export interface Collection {
  id: string;
  name: string;
  thumbnail_url: string | null;
  created_at: string;
}

export interface CollectionImage {
  id: string;
  collection_id: string;
  image_url: string;
  is_main: boolean;
  name: string;
  order_index: number;
  created_at: string;
}

export interface CollectionGroup extends Collection {
  images: CollectionImage[];
  mainImage: CollectionImage | null;
  linkedImages: CollectionImage[];
}

// Plant types
export interface Plant {
  id: string;
  name: string;
  image_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

// Editor types
export type EditorStep = 'collection-select' | 'editing';
export type EditorMode = 'single' | 'multi';
export type BrushColor = 'red' | 'blue' | 'yellow';

export interface PlantSelection {
  plant: Plant;
  color: BrushColor;
}

export const BRUSH_COLORS: Record<BrushColor, string> = {
  red: 'rgba(239, 68, 68, 0.6)',
  blue: 'rgba(59, 130, 246, 0.6)',
  yellow: 'rgba(234, 179, 8, 0.6)',
};

export const BRUSH_COLORS_SOLID: Record<BrushColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#eab308',
};

// Generation types
export interface GenerationResult {
  id: string;
  imageUrl: string;
  originalImageUrl: string;
  plantNames: string[];
  createdAt: string;
}

// Implement types
export type ImplementPhase = 'setup' | 'running' | 'complete' | 'error';
export type PipelineStep = 'idle' | 'analyzing' | 'generating' | 'applying' | 'complete';

export interface PipelineLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface ProcessedImage {
  targetImage: CollectionImage;
  results: string[]; // URLs of 3 variations
  status: 'pending' | 'processing' | 'complete' | 'error';
  error?: string;
}

export interface ImplementState {
  phase: ImplementPhase;
  pipelineStep: PipelineStep;
  originalImageUrl: string;
  editedImageUrl: string;
  availableImages: CollectionImage[];
  selectedImageIds: string[];
  logs: PipelineLog[];
  results: ProcessedImage[];
  analysisResult?: string;
  // Prompt overrides
  analyzePromptOverride: string;
  generatePromptOverride: string;
  applySystemPromptOverride: string;
}

// Settings types
export interface AppSettings {
  system_prompt: string;
  implement_prompt_analyze: string;
  implement_prompt_generate: string;
  implement_prompt_apply: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GenerateRequest {
  canvasDataUrl: string;
  plants: Array<{
    name: string;
    imageUrl: string;
    color: BrushColor;
  }>;
  mode: EditorMode;
}

export interface GenerateResponse {
  images: string[];
}

export interface ImplementRequest {
  originalImageUrl: string;
  editedImageUrl: string;
  targetImages: CollectionImage[];
  plants: Array<{
    name: string;
    imageUrl: string;
  }>;
  prompts: {
    analyze: string;
    generate: string;
    apply: string;
  };
}
