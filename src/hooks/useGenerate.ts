import { useState, useCallback } from 'react';
import { generateApi } from '@/services/api';
import { useEditorStore } from '@/stores/editorStore';
import { generateUUID } from '@/lib/utils';

export function useGenerate() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    selectedPlant,
    multiPlantSelections,
    editorMode,
    canvasImageUrl,
    setIsGenerating,
    setResults,
    setShowResultsModal,
  } = useEditorStore();

  const generate = useCallback(
    async (canvasDataUrl: string) => {
      setIsLoading(true);
      setError(null);
      setIsGenerating(true);

      try {
        // Prepare plants data based on mode
        let plants: Array<{ name: string; imageUrl: string; color: string }> = [];

        if (editorMode === 'single') {
          if (!selectedPlant) {
            throw new Error('Please select a plant');
          }
          plants = [
            {
              name: selectedPlant.name,
              imageUrl: selectedPlant.image_url,
              color: 'red',
            },
          ];
        } else {
          if (multiPlantSelections.length === 0) {
            throw new Error('Please select at least one plant');
          }
          plants = multiPlantSelections.map((selection) => ({
            name: selection.plant.name,
            imageUrl: selection.plant.image_url,
            color: selection.color,
          }));
        }

        const result = await generateApi.generate({
          canvasDataUrl,
          plants,
          mode: editorMode,
        });

        // Create result objects
        const generationResults = result.images.map((imageUrl) => ({
          id: generateUUID(),
          imageUrl,
          originalImageUrl: canvasImageUrl || '',
          plantNames: plants.map((p) => p.name),
          createdAt: new Date().toISOString(),
        }));

        setResults(generationResults);
        setShowResultsModal(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Generation failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
        setIsGenerating(false);
      }
    },
    [
      editorMode,
      selectedPlant,
      multiPlantSelections,
      canvasImageUrl,
      setIsGenerating,
      setResults,
      setShowResultsModal,
    ]
  );

  return {
    generate,
    isLoading,
    error,
  };
}
