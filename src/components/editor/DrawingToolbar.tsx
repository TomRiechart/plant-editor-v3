import { useEditorStore } from '@/stores/editorStore';
import { useGenerate } from '@/hooks/useGenerate';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Eraser, Undo2, Wand2, Loader2 } from 'lucide-react';
import { BRUSH_COLORS_SOLID } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export default function DrawingToolbar() {
  const {
    drawingState,
    setBrushSize,
    currentBrushColor,
    setCurrentBrushColor,
    editorMode,
    selectedPlant,
    multiPlantSelections,
    isGenerating,
  } = useEditorStore();

  const { generate, isLoading } = useGenerate();

  const handleClear = () => {
    (window as any).clearCanvasDrawings?.();
  };

  const handleUndo = () => {
    (window as any).undoCanvasStroke?.();
  };

  const handleGenerate = async () => {
    // Validate
    if (editorMode === 'single' && !selectedPlant) {
      toast({
        title: 'No plant selected',
        description: 'Please select a plant from the sidebar',
        variant: 'destructive',
      });
      return;
    }

    if (editorMode === 'multi' && multiPlantSelections.length === 0) {
      toast({
        title: 'No plants selected',
        description: 'Please select at least one plant in multi-plant mode',
        variant: 'destructive',
      });
      return;
    }

    // Get canvas data
    const canvasDataUrl = (window as any).getCanvasDataUrl?.();
    if (!canvasDataUrl) {
      toast({
        title: 'Error',
        description: 'Could not get canvas data',
        variant: 'destructive',
      });
      return;
    }

    try {
      await generate(canvasDataUrl);
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const canGenerate =
    (editorMode === 'single' && selectedPlant) ||
    (editorMode === 'multi' && multiPlantSelections.length > 0);

  return (
    <div className="mt-4 p-4 bg-card rounded-lg border">
      <div className="flex items-center gap-6">
        {/* Brush Color (only in multi mode) */}
        {editorMode === 'multi' && (
          <div className="flex items-center gap-2">
            <Label className="text-sm">Color:</Label>
            <div className="flex gap-1">
              {(['red', 'blue', 'yellow'] as const).map((color) => (
                <button
                  key={color}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    currentBrushColor === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent'
                  )}
                  style={{ backgroundColor: BRUSH_COLORS_SOLID[color] }}
                  onClick={() => setCurrentBrushColor(color)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Brush Size */}
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Label className="text-sm whitespace-nowrap">Brush Size:</Label>
          <Slider
            value={[drawingState.brushSize]}
            onValueChange={([value]) => setBrushSize(value)}
            min={5}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-8">
            {drawingState.brushSize}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Eraser className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={handleUndo}>
            <Undo2 className="h-4 w-4 mr-1" />
            Undo
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating || isLoading}
          >
            {(isGenerating || isLoading) ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-1" />
            )}
            Generate
          </Button>
        </div>
      </div>
    </div>
  );
}
