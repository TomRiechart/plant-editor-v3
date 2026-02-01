import { useState, useRef } from 'react';
import {
  useAddCollectionImages,
  useSetMainImage,
  useDeleteCollectionImage,
} from '@/hooks/useCollections';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Star, Trash2, Upload, Loader2, Check } from 'lucide-react';
import type { CollectionGroup } from '@/types';
import { cn } from '@/lib/utils';

interface CollectionDetailProps {
  collection: CollectionGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAndContinue: () => void;
}

export default function CollectionDetail({
  collection,
  open,
  onOpenChange,
  onSelectAndContinue,
}: CollectionDetailProps) {
  const addImages = useAddCollectionImages();
  const setMainImage = useSetMainImage();
  const deleteImage = useDeleteCollectionImage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      await addImages.mutateAsync({
        collectionId: collection.id,
        files,
      });
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSetMain = async (imageId: string) => {
    await setMainImage.mutateAsync({
      collectionId: collection.id,
      imageId,
    });
  };

  const handleDelete = async (imageId: string) => {
    if (confirm('Delete this image?')) {
      await deleteImage.mutateAsync({
        collectionId: collection.id,
        imageId,
      });
    }
  };

  const mainImage = collection.images?.find((img) => img.is_main);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{collection.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Main Image Section */}
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              Main Image (for editing in Step 1)
            </h3>
            {mainImage ? (
              <div className="relative w-full max-w-lg aspect-video rounded-lg overflow-hidden border-2 border-yellow-500 bg-muted">
                <img
                  src={mainImage.image_url}
                  alt="Main"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 bg-yellow-500 text-yellow-950 px-2 py-1 rounded text-xs font-medium">
                  Main Image
                </div>
              </div>
            ) : (
              <div className="w-full max-w-lg aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  Upload an image and set it as main
                </p>
              </div>
            )}
          </div>

          {/* Linked Images Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">
                Linked Images (for Step 2.5 - Auto Implementation)
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload Images
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              {collection.images?.map((image) => (
                <div
                  key={image.id}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border-2 bg-muted group',
                    image.is_main ? 'border-yellow-500' : 'border-transparent'
                  )}
                >
                  <img
                    src={image.image_url}
                    alt={image.name || 'Image'}
                    className="w-full h-full object-cover"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    {!image.is_main && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={() => handleSetMain(image.id)}
                        title="Set as main"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={() => handleDelete(image.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {image.is_main && (
                    <div className="absolute top-1 left-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    </div>
                  )}
                </div>
              ))}

              {/* Upload placeholder */}
              <div
                className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={onSelectAndContinue}
            disabled={!mainImage}
          >
            <Check className="h-4 w-4 mr-1" />
            Select & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
