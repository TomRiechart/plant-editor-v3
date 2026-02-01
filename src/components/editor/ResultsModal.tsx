import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Wand2, Edit2, RefreshCw, Loader2 } from 'lucide-react';
import { downloadFile } from '@/lib/utils';
import ImageCompareWiper from './ImageCompareWiper';
import ImplementModal from './ImplementModal';

export default function ResultsModal() {
  const {
    showResultsModal,
    setShowResultsModal,
    results,
    isGenerating,
    canvasImageUrl,
    selectedCollectionGroup,
    setCanvasImageUrl,
    initImplement,
  } = useEditorStore();

  const [showImplement, setShowImplement] = useState(false);
  // Removed hover tracking - wiper is always active now

  const handleDownload = async (imageUrl: string, index: number) => {
    const filename = `plant-edit-${Date.now()}-v${index + 1}.png`;
    await downloadFile(imageUrl, filename);
  };

  const handleEditThis = (imageUrl: string) => {
    setCanvasImageUrl(imageUrl);
    setShowResultsModal(false);
  };

  const handleImplement = (imageUrl: string) => {
    // Get linked images from collection
    const linkedImages = selectedCollectionGroup?.linkedImages || [];
    
    if (linkedImages.length === 0) {
      alert('No linked images in this collection. Add images to the collection first.');
      return;
    }

    initImplement(canvasImageUrl || '', imageUrl, linkedImages);
    setShowImplement(true);
  };

  const handleRegenerate = () => {
    // Clear results and close modal to regenerate
    setShowResultsModal(false);
    // User will need to click Generate again
  };

  return (
    <>
      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Generated Variations</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isGenerating}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerate
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Generating variations...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This may take 2-3 minutes
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No results yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {results.map((result, index) => (
                  <div
                    key={result.id}
                    className="relative rounded-lg overflow-hidden border bg-muted group"
                  >
                    {/* Image with compare wiper - always active */}
                    <div className="aspect-[4/3]">
                      <ImageCompareWiper
                        originalUrl={result.originalImageUrl}
                        editedUrl={result.imageUrl}
                        alwaysActive={true}
                      />
                    </div>

                    {/* Variation label */}
                    <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                      Variation {index + 1}
                    </div>

                    {/* Action buttons */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload(result.imageUrl, index)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleImplement(result.imageUrl)}
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleEditThis(result.imageUrl)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          {results.length > 0 && (
            <div className="border-t pt-3 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span>
                <Download className="h-4 w-4 inline mr-1" /> Download
              </span>
              <span>
                <Wand2 className="h-4 w-4 inline mr-1" /> Implement to all images
              </span>
              <span>
                <Edit2 className="h-4 w-4 inline mr-1" /> Edit this result
              </span>
              <span className="text-xs">גרור את הפס להשוואה</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Implement Modal */}
      <ImplementModal
        open={showImplement}
        onOpenChange={setShowImplement}
      />
    </>
  );
}
