import { useState, useCallback, useRef } from 'react';
import { implementApi } from '@/services/api';
import { useEditorStore } from '@/stores/editorStore';

export function useImplement() {
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);

  const {
    implementState,
    setImplementPhase,
    setImplementPipelineStep,
    addImplementLog,
    addProcessedImage,
    updateProcessedImage,
    setAnalysisResult,
  } = useEditorStore();

  const startImplement = useCallback(
    async (
      plants: Array<{ name: string; imageUrl: string }>,
      promptOverrides?: {
        analyze?: string;
        generate?: string;
        apply?: string;
      }
    ) => {
      const { originalImageUrl, editedImageUrl, availableImages, selectedImageIds } =
        implementState;

      // Get selected images
      const targetImages = availableImages.filter((img) =>
        selectedImageIds.includes(img.id)
      );

      if (targetImages.length === 0) {
        addImplementLog({ message: 'No images selected', type: 'error' });
        return;
      }

      setIsRunning(true);
      abortRef.current = false;
      setImplementPhase('running');
      setImplementPipelineStep('analyzing');

      addImplementLog({ message: 'Starting implement pipeline...', type: 'info' });

      // Initialize processed images
      targetImages.forEach((img) => {
        addProcessedImage({
          targetImage: img,
          results: [],
          status: 'pending',
        });
      });

      try {
        await implementApi.startWithFetch(
          {
            originalImageUrl,
            editedImageUrl,
            targetImages,
            plants,
            prompts: {
              analyze: promptOverrides?.analyze || implementState.analyzePromptOverride,
              generate: promptOverrides?.generate || implementState.generatePromptOverride,
              apply: promptOverrides?.apply || implementState.applySystemPromptOverride,
            },
          },
          // onMessage
          (event) => {
            if (abortRef.current) return;

            // Handle keepAlive
            if (event.keepAlive) return;

            // Handle errors
            if (event.error) {
              addImplementLog({ message: event.error, type: 'error' });
              setImplementPhase('error');
              return;
            }

            // Update pipeline step
            if (event.step) {
              switch (event.step) {
                case 'analyzing':
                  setImplementPipelineStep('analyzing');
                  break;
                case 'generating':
                  setImplementPipelineStep('generating');
                  break;
                case 'applying':
                  setImplementPipelineStep('applying');
                  break;
                case 'complete':
                  setImplementPipelineStep('complete');
                  setImplementPhase('complete');
                  break;
              }
            }

            // Log message
            if (event.message) {
              addImplementLog({ message: event.message, type: 'info' });
            }

            // Handle analysis result
            if (event.analysisResult) {
              setAnalysisResult(event.analysisResult);
            }

            // Handle image results
            if (event.imageResult) {
              updateProcessedImage(event.imageResult.targetId, {
                results: event.imageResult.results,
                status: event.imageResult.status,
                error: event.imageResult.error,
              });
            }
          },
          // onError
          (error) => {
            addImplementLog({ message: error.message, type: 'error' });
            setImplementPhase('error');
            setIsRunning(false);
          },
          // onComplete
          () => {
            addImplementLog({ message: 'Pipeline complete', type: 'success' });
            setIsRunning(false);
          }
        );
      } catch (error) {
        addImplementLog({
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'error',
        });
        setImplementPhase('error');
        setIsRunning(false);
      }
    },
    [
      implementState,
      setImplementPhase,
      setImplementPipelineStep,
      addImplementLog,
      addProcessedImage,
      updateProcessedImage,
      setAnalysisResult,
    ]
  );

  const abort = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
    addImplementLog({ message: 'Pipeline aborted', type: 'warning' });
  }, [addImplementLog]);

  return {
    startImplement,
    abort,
    isRunning,
  };
}
