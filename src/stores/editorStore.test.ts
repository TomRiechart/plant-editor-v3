import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editorStore';
import type { Plant, CollectionGroup, CollectionImage } from '@/types';

// Reset store before each test
beforeEach(() => {
  useEditorStore.getState().resetEditor();
});

describe('editorStore - Navigation', () => {
  it('should have initial editorStep as collection-select', () => {
    expect(useEditorStore.getState().editorStep).toBe('collection-select');
  });

  it('should update editorStep', () => {
    useEditorStore.getState().setEditorStep('editing');
    expect(useEditorStore.getState().editorStep).toBe('editing');
  });

  it('should switch back to collection-select', () => {
    useEditorStore.getState().setEditorStep('editing');
    useEditorStore.getState().setEditorStep('collection-select');
    expect(useEditorStore.getState().editorStep).toBe('collection-select');
  });
});

describe('editorStore - Collection Context', () => {
  const mockCollection: CollectionGroup = {
    id: 'col-1',
    name: 'Test Collection',
    thumbnail_url: '/test.jpg',
    created_at: '2026-01-31T12:00:00Z',
    images: [],
    mainImage: null,
    linkedImages: [],
  };

  it('should set selected collection group', () => {
    useEditorStore.getState().setSelectedCollectionGroup(mockCollection);
    expect(useEditorStore.getState().selectedCollectionGroup).toEqual(mockCollection);
  });

  it('should clear selected collection group', () => {
    useEditorStore.getState().setSelectedCollectionGroup(mockCollection);
    useEditorStore.getState().setSelectedCollectionGroup(null);
    expect(useEditorStore.getState().selectedCollectionGroup).toBeNull();
  });
});

describe('editorStore - Plant Selection (Single Mode)', () => {
  const mockPlant: Plant = {
    id: 'plant-1',
    name: 'Monstera',
    image_url: '/monstera.jpg',
    thumbnail_url: '/monstera-thumb.jpg',
    created_at: '2026-01-31T12:00:00Z',
  };

  it('should select a plant', () => {
    useEditorStore.getState().setSelectedPlant(mockPlant);
    expect(useEditorStore.getState().selectedPlant).toEqual(mockPlant);
  });

  it('should clear selected plant', () => {
    useEditorStore.getState().setSelectedPlant(mockPlant);
    useEditorStore.getState().setSelectedPlant(null);
    expect(useEditorStore.getState().selectedPlant).toBeNull();
  });

  it('should replace selected plant', () => {
    const anotherPlant: Plant = {
      id: 'plant-2',
      name: 'Ficus',
      image_url: '/ficus.jpg',
      thumbnail_url: '/ficus-thumb.jpg',
      created_at: '2026-01-31T12:00:00Z',
    };
    
    useEditorStore.getState().setSelectedPlant(mockPlant);
    useEditorStore.getState().setSelectedPlant(anotherPlant);
    expect(useEditorStore.getState().selectedPlant?.id).toBe('plant-2');
  });
});

describe('editorStore - Multi-Plant Selection', () => {
  const plant1: Plant = {
    id: 'plant-1',
    name: 'Monstera',
    image_url: '/monstera.jpg',
    thumbnail_url: null,
    created_at: '2026-01-31T12:00:00Z',
  };

  const plant2: Plant = {
    id: 'plant-2',
    name: 'Ficus',
    image_url: '/ficus.jpg',
    thumbnail_url: null,
    created_at: '2026-01-31T12:00:00Z',
  };

  const plant3: Plant = {
    id: 'plant-3',
    name: 'Palm',
    image_url: '/palm.jpg',
    thumbnail_url: null,
    created_at: '2026-01-31T12:00:00Z',
  };

  it('should add plant to multi selection', () => {
    useEditorStore.getState().addMultiPlantSelection(plant1, 'red');
    const selections = useEditorStore.getState().multiPlantSelections;
    
    expect(selections).toHaveLength(1);
    expect(selections[0].plant.id).toBe('plant-1');
    expect(selections[0].color).toBe('red');
  });

  it('should add multiple plants with different colors', () => {
    useEditorStore.getState().addMultiPlantSelection(plant1, 'red');
    useEditorStore.getState().addMultiPlantSelection(plant2, 'blue');
    useEditorStore.getState().addMultiPlantSelection(plant3, 'yellow');
    
    const selections = useEditorStore.getState().multiPlantSelections;
    expect(selections).toHaveLength(3);
  });

  it('should replace plant if same color is used', () => {
    useEditorStore.getState().addMultiPlantSelection(plant1, 'red');
    useEditorStore.getState().addMultiPlantSelection(plant2, 'red');
    
    const selections = useEditorStore.getState().multiPlantSelections;
    expect(selections).toHaveLength(1);
    expect(selections[0].plant.id).toBe('plant-2');
  });

  it('should remove plant by color', () => {
    useEditorStore.getState().addMultiPlantSelection(plant1, 'red');
    useEditorStore.getState().addMultiPlantSelection(plant2, 'blue');
    useEditorStore.getState().removeMultiPlantSelection('red');
    
    const selections = useEditorStore.getState().multiPlantSelections;
    expect(selections).toHaveLength(1);
    expect(selections[0].color).toBe('blue');
  });

  it('should clear all multi selections', () => {
    useEditorStore.getState().addMultiPlantSelection(plant1, 'red');
    useEditorStore.getState().addMultiPlantSelection(plant2, 'blue');
    useEditorStore.getState().clearMultiPlantSelections();
    
    expect(useEditorStore.getState().multiPlantSelections).toHaveLength(0);
  });
});

describe('editorStore - Editor Mode', () => {
  it('should have initial mode as single', () => {
    expect(useEditorStore.getState().editorMode).toBe('single');
  });

  it('should switch to multi mode', () => {
    useEditorStore.getState().setEditorMode('multi');
    expect(useEditorStore.getState().editorMode).toBe('multi');
  });

  it('should switch back to single mode', () => {
    useEditorStore.getState().setEditorMode('multi');
    useEditorStore.getState().setEditorMode('single');
    expect(useEditorStore.getState().editorMode).toBe('single');
  });
});

describe('editorStore - Brush Settings', () => {
  it('should have initial brush color as red', () => {
    expect(useEditorStore.getState().currentBrushColor).toBe('red');
  });

  it('should change brush color', () => {
    useEditorStore.getState().setCurrentBrushColor('blue');
    expect(useEditorStore.getState().currentBrushColor).toBe('blue');
    
    useEditorStore.getState().setCurrentBrushColor('yellow');
    expect(useEditorStore.getState().currentBrushColor).toBe('yellow');
  });

  it('should have initial brush size', () => {
    expect(useEditorStore.getState().drawingState.brushSize).toBe(30);
  });

  it('should update brush size', () => {
    useEditorStore.getState().setBrushSize(50);
    expect(useEditorStore.getState().drawingState.brushSize).toBe(50);
  });

  it('should handle min and max brush sizes', () => {
    useEditorStore.getState().setBrushSize(5);
    expect(useEditorStore.getState().drawingState.brushSize).toBe(5);
    
    useEditorStore.getState().setBrushSize(100);
    expect(useEditorStore.getState().drawingState.brushSize).toBe(100);
  });
});

describe('editorStore - Canvas', () => {
  it('should have no canvas image initially', () => {
    expect(useEditorStore.getState().canvasImageUrl).toBeNull();
  });

  it('should set canvas image URL', () => {
    useEditorStore.getState().setCanvasImageUrl('/test-image.jpg');
    expect(useEditorStore.getState().canvasImageUrl).toBe('/test-image.jpg');
  });

  it('should clear canvas image', () => {
    useEditorStore.getState().setCanvasImageUrl('/test-image.jpg');
    useEditorStore.getState().setCanvasImageUrl(null);
    expect(useEditorStore.getState().canvasImageUrl).toBeNull();
  });
});

describe('editorStore - Generation State', () => {
  it('should have isGenerating as false initially', () => {
    expect(useEditorStore.getState().isGenerating).toBe(false);
  });

  it('should set generating state', () => {
    useEditorStore.getState().setIsGenerating(true);
    expect(useEditorStore.getState().isGenerating).toBe(true);
  });

  it('should have empty results initially', () => {
    expect(useEditorStore.getState().results).toHaveLength(0);
  });

  it('should add results', () => {
    const result = {
      id: 'result-1',
      imageUrl: '/result.jpg',
      originalImageUrl: '/original.jpg',
      plantNames: ['Monstera'],
      createdAt: '2026-01-31T12:00:00Z',
    };
    
    useEditorStore.getState().addResult(result);
    expect(useEditorStore.getState().results).toHaveLength(1);
  });

  it('should set results array', () => {
    const results = [
      { id: '1', imageUrl: '/1.jpg', originalImageUrl: '/o.jpg', plantNames: ['A'], createdAt: '' },
      { id: '2', imageUrl: '/2.jpg', originalImageUrl: '/o.jpg', plantNames: ['B'], createdAt: '' },
      { id: '3', imageUrl: '/3.jpg', originalImageUrl: '/o.jpg', plantNames: ['C'], createdAt: '' },
    ];
    
    useEditorStore.getState().setResults(results);
    expect(useEditorStore.getState().results).toHaveLength(3);
  });

  it('should clear results', () => {
    useEditorStore.getState().addResult({
      id: '1', imageUrl: '/1.jpg', originalImageUrl: '/o.jpg', plantNames: [], createdAt: ''
    });
    useEditorStore.getState().clearResults();
    expect(useEditorStore.getState().results).toHaveLength(0);
  });

  it('should toggle results modal', () => {
    expect(useEditorStore.getState().showResultsModal).toBe(false);
    
    useEditorStore.getState().setShowResultsModal(true);
    expect(useEditorStore.getState().showResultsModal).toBe(true);
  });
});

describe('editorStore - Implement State', () => {
  const mockImages: CollectionImage[] = [
    { id: 'img-1', collection_id: 'col-1', image_url: '/1.jpg', is_main: false, name: 'Image 1', order_index: 0, created_at: '' },
    { id: 'img-2', collection_id: 'col-1', image_url: '/2.jpg', is_main: false, name: 'Image 2', order_index: 1, created_at: '' },
    { id: 'img-3', collection_id: 'col-1', image_url: '/3.jpg', is_main: false, name: 'Image 3', order_index: 2, created_at: '' },
  ];

  it('should have initial implement phase as setup', () => {
    expect(useEditorStore.getState().implementState.phase).toBe('setup');
  });

  it('should initialize implement state', () => {
    useEditorStore.getState().initImplement('/original.jpg', '/edited.jpg', mockImages);
    
    const state = useEditorStore.getState().implementState;
    expect(state.originalImageUrl).toBe('/original.jpg');
    expect(state.editedImageUrl).toBe('/edited.jpg');
    expect(state.availableImages).toHaveLength(3);
    expect(state.selectedImageIds).toHaveLength(3); // All selected by default
  });

  it('should toggle image selection', () => {
    useEditorStore.getState().initImplement('/o.jpg', '/e.jpg', mockImages);
    useEditorStore.getState().toggleImageSelection('img-1');
    
    const selectedIds = useEditorStore.getState().implementState.selectedImageIds;
    expect(selectedIds).not.toContain('img-1');
    expect(selectedIds).toHaveLength(2);
  });

  it('should select all images', () => {
    useEditorStore.getState().initImplement('/o.jpg', '/e.jpg', mockImages);
    useEditorStore.getState().toggleImageSelection('img-1');
    useEditorStore.getState().toggleImageSelection('img-2');
    useEditorStore.getState().selectAllImages();
    
    expect(useEditorStore.getState().implementState.selectedImageIds).toHaveLength(3);
  });

  it('should clear image selection', () => {
    useEditorStore.getState().initImplement('/o.jpg', '/e.jpg', mockImages);
    useEditorStore.getState().clearImageSelection();
    
    expect(useEditorStore.getState().implementState.selectedImageIds).toHaveLength(0);
  });

  it('should update implement phase', () => {
    useEditorStore.getState().setImplementPhase('running');
    expect(useEditorStore.getState().implementState.phase).toBe('running');
  });

  it('should update pipeline step', () => {
    useEditorStore.getState().setImplementPipelineStep('analyzing');
    expect(useEditorStore.getState().implementState.pipelineStep).toBe('analyzing');
  });

  it('should add implement logs', () => {
    useEditorStore.getState().addImplementLog({ message: 'Starting...', type: 'info' });
    useEditorStore.getState().addImplementLog({ message: 'Done!', type: 'success' });
    
    const logs = useEditorStore.getState().implementState.logs;
    expect(logs).toHaveLength(2);
    expect(logs[0].message).toBe('Starting...');
    expect(logs[0].type).toBe('info');
    expect(logs[0].timestamp).toBeTruthy();
  });

  it('should reset implement state', () => {
    useEditorStore.getState().initImplement('/o.jpg', '/e.jpg', mockImages);
    useEditorStore.getState().setImplementPhase('running');
    useEditorStore.getState().addImplementLog({ message: 'Test', type: 'info' });
    useEditorStore.getState().resetImplementState();
    
    const state = useEditorStore.getState().implementState;
    expect(state.phase).toBe('setup');
    expect(state.logs).toHaveLength(0);
    expect(state.selectedImageIds).toHaveLength(0);
  });
});

describe('editorStore - Reset', () => {
  it('should reset entire editor state', () => {
    // Set various states
    useEditorStore.getState().setEditorStep('editing');
    useEditorStore.getState().setEditorMode('multi');
    useEditorStore.getState().setBrushSize(75);
    useEditorStore.getState().setCurrentBrushColor('blue');
    useEditorStore.getState().setCanvasImageUrl('/test.jpg');
    useEditorStore.getState().setIsGenerating(true);
    
    // Reset
    useEditorStore.getState().resetEditor();
    
    // Verify defaults
    const state = useEditorStore.getState();
    expect(state.editorStep).toBe('collection-select');
    expect(state.editorMode).toBe('single');
    expect(state.currentBrushColor).toBe('red');
    expect(state.canvasImageUrl).toBeNull();
    expect(state.isGenerating).toBe(false);
    expect(state.results).toHaveLength(0);
  });
});
