import { useState, useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { useImplement } from '@/hooks/useImplement';
import { useSettings } from '@/hooks/useSettings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Clock,
  Download,
} from 'lucide-react';
import { cn, downloadFile } from '@/lib/utils';

interface ImplementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImplementModal({ open, onOpenChange }: ImplementModalProps) {
  const {
    implementState,
    toggleImageSelection,
    selectAllImages,
    clearImageSelection,
    setImplementPromptOverride,
    resetImplementState,
    selectedPlant,
    multiPlantSelections,
    editorMode,
  } = useEditorStore();

  const { startImplement, abort, isRunning } = useImplement();
  const { data: settings } = useSettings();
  const [showPrompts, setShowPrompts] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Initialize prompt overrides from settings
  useEffect(() => {
    if (settings && open) {
      if (!implementState.analyzePromptOverride) {
        setImplementPromptOverride('analyzePromptOverride', settings.implement_prompt_analyze || '');
      }
      if (!implementState.generatePromptOverride) {
        setImplementPromptOverride('generatePromptOverride', settings.implement_prompt_generate || '');
      }
      if (!implementState.applySystemPromptOverride) {
        setImplementPromptOverride('applySystemPromptOverride', settings.implement_prompt_apply || '');
      }
    }
  }, [settings, open]);

  const handleStart = () => {
    // Prepare plants data
    let plants: Array<{ name: string; imageUrl: string }> = [];
    if (editorMode === 'single' && selectedPlant) {
      plants = [{ name: selectedPlant.name, imageUrl: selectedPlant.image_url }];
    } else {
      plants = multiPlantSelections.map((s) => ({
        name: s.plant.name,
        imageUrl: s.plant.image_url,
      }));
    }

    startImplement(plants);
  };

  const handleClose = () => {
    if (isRunning) {
      if (confirm('Pipeline is running. Are you sure you want to close?')) {
        abort();
        onOpenChange(false);
      }
    } else {
      resetImplementState();
      onOpenChange(false);
    }
  };

  const handleDownloadResult = async (url: string, targetName: string, varIndex: number) => {
    const filename = `implement-${targetName}-v${varIndex + 1}-${Date.now()}.png`;
    await downloadFile(url, filename);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    switch (implementState.pipelineStep) {
      case 'idle':
        return 0;
      case 'analyzing':
        return 15;
      case 'generating':
        return 40;
      case 'applying':
        const completed = implementState.results.filter(
          (r) => r.status === 'complete' || r.status === 'error'
        ).length;
        const total = implementState.selectedImageIds.length;
        return 40 + (completed / total) * 55;
      case 'complete':
        return 100;
      default:
        return 0;
    }
  };

  const { phase, availableImages, selectedImageIds, logs, results, originalImageUrl, editedImageUrl } =
    implementState;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {phase === 'setup' && '⚙️ Implement Setup'}
            {phase === 'running' && '🔄 Running Pipeline...'}
            {phase === 'complete' && '✅ Implementation Complete'}
            {phase === 'error' && '❌ Pipeline Error'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Reference Images */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Original</Label>
              <div className="aspect-video rounded-lg overflow-hidden border bg-muted mt-1">
                {originalImageUrl && (
                  <img
                    src={originalImageUrl}
                    alt="Original"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Edited (Target)</Label>
              <div className="aspect-video rounded-lg overflow-hidden border bg-muted mt-1">
                {editedImageUrl && (
                  <img
                    src={editedImageUrl}
                    alt="Edited"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Image Selection (Setup Phase) */}
          {phase === 'setup' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Select Images to Apply Changes</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAllImages}>
                    Select All
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearImageSelection}>
                    Clear
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Selected: {selectedImageIds.length}/{availableImages.length} images
              </p>

              <div className="grid grid-cols-5 gap-2">
                {availableImages.map((image) => (
                  <div
                    key={image.id}
                    className={cn(
                      'relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all',
                      selectedImageIds.includes(image.id)
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-transparent hover:border-primary/50'
                    )}
                    onClick={() => toggleImageSelection(image.id)}
                  >
                    <img
                      src={image.image_url}
                      alt={image.name || 'Image'}
                      className="w-full h-full object-cover"
                    />
                    {selectedImageIds.includes(image.id) && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress (Running Phase) */}
          {(phase === 'running' || phase === 'complete') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Progress</span>
                  {isRunning && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatTime(elapsedTime)}
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {implementState.pipelineStep}
                </span>
              </div>
              <Progress value={getProgress()} className="h-2" />

              {/* Pipeline Steps */}
              <div className="flex items-center justify-between mt-4 px-4">
                {['analyzing', 'generating', 'applying', 'complete'].map((step, i) => {
                  const current = ['idle', 'analyzing', 'generating', 'applying', 'complete'].indexOf(
                    implementState.pipelineStep
                  );
                  const stepIndex = i + 1;
                  const isComplete = current > stepIndex;
                  const isCurrent = current === stepIndex;

                  return (
                    <div
                      key={step}
                      className={cn(
                        'flex flex-col items-center gap-1',
                        isComplete && 'text-primary',
                        isCurrent && 'text-primary font-medium',
                        !isComplete && !isCurrent && 'text-muted-foreground'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center border-2',
                          isComplete && 'bg-primary border-primary text-primary-foreground',
                          isCurrent && 'border-primary',
                          !isComplete && !isCurrent && 'border-muted-foreground'
                        )}
                      >
                        {isComplete ? (
                          <Check className="h-4 w-4" />
                        ) : isCurrent && isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <span className="text-sm">{i + 1}</span>
                        )}
                      </div>
                      <span className="text-xs capitalize">{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-muted rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-xs">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    'py-0.5',
                    log.type === 'error' && 'text-destructive',
                    log.type === 'success' && 'text-green-600',
                    log.type === 'warning' && 'text-yellow-600'
                  )}
                >
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && phase === 'complete' && (
            <div>
              <Label className="mb-3 block">Results</Label>
              <div className="space-y-4">
                {results.map((result) => (
                  <div key={result.targetImage.id} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {result.status === 'complete' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-medium">{result.targetImage.name || 'Image'}</span>
                      {result.error && (
                        <span className="text-sm text-destructive">{result.error}</span>
                      )}
                    </div>
                    {result.results.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {result.results.map((url, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={url}
                              alt={`Variation ${i + 1}`}
                              className="w-full aspect-video object-cover rounded"
                            />
                            <Button
                              size="icon"
                              variant="secondary"
                              className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                handleDownloadResult(url, result.targetImage.name || 'image', i)
                              }
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advanced: Prompt Overrides */}
          {phase === 'setup' && (
            <div>
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => setShowPrompts(!showPrompts)}
              >
                <span>▶ AI Prompts (Advanced)</span>
                {showPrompts ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showPrompts && (
                <div className="space-y-4 mt-4 border-t pt-4">
                  <div>
                    <Label className="text-sm">Step 1: Analyze Differences</Label>
                    <p className="text-xs text-muted-foreground mb-1">Model: Gemini 1.5 Pro</p>
                    <Textarea
                      value={implementState.analyzePromptOverride}
                      onChange={(e) =>
                        setImplementPromptOverride('analyzePromptOverride', e.target.value)
                      }
                      className="h-24 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Step 2.5: Generate Editing Prompt</Label>
                    <p className="text-xs text-muted-foreground mb-1">
                      Model: Gemini 1.5 Pro · Use {'{analysis}'} placeholder
                    </p>
                    <Textarea
                      value={implementState.generatePromptOverride}
                      onChange={(e) =>
                        setImplementPromptOverride('generatePromptOverride', e.target.value)
                      }
                      className="h-24 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Step 3: Apply Changes</Label>
                    <p className="text-xs text-muted-foreground mb-1">
                      Model: Nano Banana Pro · Use {'{customPrompt}'} placeholder
                    </p>
                    <Textarea
                      value={implementState.applySystemPromptOverride}
                      onChange={(e) =>
                        setImplementPromptOverride('applySystemPromptOverride', e.target.value)
                      }
                      className="h-24 font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {phase === 'complete' ? 'Close' : 'Cancel'}
          </Button>
          {phase === 'setup' && (
            <Button onClick={handleStart} disabled={selectedImageIds.length === 0}>
              <Play className="h-4 w-4 mr-1" />
              Start Implement ({selectedImageIds.length})
            </Button>
          )}
          {phase === 'running' && (
            <Button variant="destructive" onClick={abort}>
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
