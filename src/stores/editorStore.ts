import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  EditorStep,
  EditorMode,
  BrushColor,
  Plant,
  PlantSelection,
  CollectionGroup,
  Collection,
  GenerationResult,
  ImplementState,
  CollectionImage,
  PipelineLog,
  ProcessedImage,
} from '@/types';

interface DrawingState {
  brushSize: number;
}

interface EditorStore {
  // Navigation
  editorStep: EditorStep;
  setEditorStep: (step: EditorStep) => void;

  // Collection Context
  selectedCollectionGroup: CollectionGroup | null;
  setSelectedCollectionGroup: (group: CollectionGroup | null) => void;
  selectedCollection: Collection | null;
  setSelectedCollection: (collection: Collection | null) => void;

  // Plant Selection
  selectedPlant: Plant | null;
  setSelectedPlant: (plant: Plant | null) => void;
  multiPlantSelections: PlantSelection[];
  addMultiPlantSelection: (plant: Plant, color: BrushColor) => void;
  removeMultiPlantSelection: (color: BrushColor) => void;
  clearMultiPlantSelections: () => void;

  // Editor Mode
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  currentBrushColor: BrushColor;
  setCurrentBrushColor: (color: BrushColor) => void;

  // Canvas
  canvasImageUrl: string | null;
  setCanvasImageUrl: (url: string | null) => void;
  drawingState: DrawingState;
  setBrushSize: (size: number) => void;

  // Generation
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  results: GenerationResult[];
  setResults: (results: GenerationResult[]) => void;
  addResult: (result: GenerationResult) => void;
  clearResults: () => void;
  showResultsModal: boolean;
  setShowResultsModal: (show: boolean) => void;

  // Implement Pipeline
  implementState: ImplementState;
  initImplement: (originalUrl: string, editedUrl: string, availableImages: CollectionImage[]) => void;
  setImplementPhase: (phase: ImplementState['phase']) => void;
  setImplementPipelineStep: (step: ImplementState['pipelineStep']) => void;
  toggleImageSelection: (imageId: string) => void;
  selectAllImages: () => void;
  clearImageSelection: () => void;
  addImplementLog: (log: Omit<PipelineLog, 'timestamp'>) => void;
  setAnalysisResult: (result: string) => void;
  addProcessedImage: (result: ProcessedImage) => void;
  updateProcessedImage: (targetImageId: string, update: Partial<ProcessedImage>) => void;
  setImplementPromptOverride: (key: keyof Pick<ImplementState, 'analyzePromptOverride' | 'generatePromptOverride' | 'applySystemPromptOverride'>, value: string) => void;
  resetImplementState: () => void;

  // Reset
  resetEditor: () => void;
}

const initialImplementState: ImplementState = {
  phase: 'setup',
  pipelineStep: 'idle',
  originalImageUrl: '',
  editedImageUrl: '',
  availableImages: [],
  selectedImageIds: [],
  logs: [],
  results: [],
  analyzePromptOverride: '',
  generatePromptOverride: '',
  applySystemPromptOverride: '',
};

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      // Navigation
      editorStep: 'collection-select',
      setEditorStep: (step) => set({ editorStep: step }),

      // Collection Context
      selectedCollectionGroup: null,
      setSelectedCollectionGroup: (group) => set({ selectedCollectionGroup: group }),
      selectedCollection: null,
      setSelectedCollection: (collection) => set({ selectedCollection: collection }),

      // Plant Selection
      selectedPlant: null,
      setSelectedPlant: (plant) => set({ selectedPlant: plant }),
      multiPlantSelections: [],
      addMultiPlantSelection: (plant, color) => {
        const current = get().multiPlantSelections;
        const filtered = current.filter((s) => s.color !== color);
        set({ multiPlantSelections: [...filtered, { plant, color }] });
      },
      removeMultiPlantSelection: (color) => {
        const current = get().multiPlantSelections;
        set({ multiPlantSelections: current.filter((s) => s.color !== color) });
      },
      clearMultiPlantSelections: () => set({ multiPlantSelections: [] }),

      // Editor Mode
      editorMode: 'single',
      setEditorMode: (mode) => set({ editorMode: mode }),
      currentBrushColor: 'red',
      setCurrentBrushColor: (color) => set({ currentBrushColor: color }),

      // Canvas
      canvasImageUrl: null,
      setCanvasImageUrl: (url) => set({ canvasImageUrl: url }),
      drawingState: { brushSize: 30 },
      setBrushSize: (size) => set({ drawingState: { brushSize: size } }),

      // Generation
      isGenerating: false,
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      results: [],
      setResults: (results) => set({ results }),
      addResult: (result) => set((state) => ({ results: [...state.results, result] })),
      clearResults: () => set({ results: [] }),
      showResultsModal: false,
      setShowResultsModal: (show) => set({ showResultsModal: show }),

      // Implement Pipeline
      implementState: initialImplementState,
      initImplement: (originalUrl, editedUrl, availableImages) => {
        set({
          implementState: {
            ...initialImplementState,
            originalImageUrl: originalUrl,
            editedImageUrl: editedUrl,
            availableImages,
            selectedImageIds: availableImages.map((img) => img.id),
          },
        });
      },
      setImplementPhase: (phase) => {
        set((state) => ({
          implementState: { ...state.implementState, phase },
        }));
      },
      setImplementPipelineStep: (step) => {
        set((state) => ({
          implementState: { ...state.implementState, pipelineStep: step },
        }));
      },
      toggleImageSelection: (imageId) => {
        set((state) => {
          const current = state.implementState.selectedImageIds;
          const newSelection = current.includes(imageId)
            ? current.filter((id) => id !== imageId)
            : [...current, imageId];
          return {
            implementState: { ...state.implementState, selectedImageIds: newSelection },
          };
        });
      },
      selectAllImages: () => {
        set((state) => ({
          implementState: {
            ...state.implementState,
            selectedImageIds: state.implementState.availableImages.map((img) => img.id),
          },
        }));
      },
      clearImageSelection: () => {
        set((state) => ({
          implementState: { ...state.implementState, selectedImageIds: [] },
        }));
      },
      addImplementLog: (log) => {
        set((state) => ({
          implementState: {
            ...state.implementState,
            logs: [
              ...state.implementState.logs,
              { ...log, timestamp: new Date().toISOString() },
            ],
          },
        }));
      },
      setAnalysisResult: (result) => {
        set((state) => ({
          implementState: { ...state.implementState, analysisResult: result },
        }));
      },
      addProcessedImage: (result) => {
        set((state) => ({
          implementState: {
            ...state.implementState,
            results: [...state.implementState.results, result],
          },
        }));
      },
      updateProcessedImage: (targetImageId, update) => {
        set((state) => ({
          implementState: {
            ...state.implementState,
            results: state.implementState.results.map((r) =>
              r.targetImage.id === targetImageId ? { ...r, ...update } : r
            ),
          },
        }));
      },
      setImplementPromptOverride: (key, value) => {
        set((state) => ({
          implementState: { ...state.implementState, [key]: value },
        }));
      },
      resetImplementState: () => {
        set({ implementState: initialImplementState });
      },

      // Reset
      resetEditor: () => {
        set({
          editorStep: 'collection-select',
          selectedCollectionGroup: null,
          selectedCollection: null,
          selectedPlant: null,
          multiPlantSelections: [],
          editorMode: 'single',
          currentBrushColor: 'red',
          canvasImageUrl: null,
          drawingState: { brushSize: 30 },
          isGenerating: false,
          results: [],
          showResultsModal: false,
          implementState: initialImplementState,
        });
      },
    }),
    {
      name: 'plant-editor-storage',
      partialize: (state) => ({
        // Only persist these fields
        drawingState: state.drawingState,
        editorMode: state.editorMode,
      }),
    }
  )
);
