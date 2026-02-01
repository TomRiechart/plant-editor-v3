import { useState } from 'react';
import { useCollections, useCreateCollection, useDeleteCollection } from '@/hooks/useCollections';
import { useEditorStore } from '@/stores/editorStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, FolderOpen, Image, Loader2 } from 'lucide-react';
import type { CollectionGroup } from '@/types';
import CollectionDetail from './CollectionDetail';

export default function CollectionSelector() {
  const { data: collections, isLoading, error } = useCollections();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const { setSelectedCollectionGroup, setEditorStep, setCanvasImageUrl } = useEditorStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [selectedForManage, setSelectedForManage] = useState<CollectionGroup | null>(null);

  const handleCreate = async () => {
    if (!newCollectionName.trim()) return;
    await createCollection.mutateAsync(newCollectionName);
    setNewCollectionName('');
    setShowCreateDialog(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this collection and all its images?')) {
      await deleteCollection.mutateAsync(id);
    }
  };

  const handleSelect = (collection: CollectionGroup) => {
    if (!collection.mainImage) {
      // Open manage dialog if no main image
      setSelectedForManage(collection);
      return;
    }
    setSelectedCollectionGroup(collection);
    setCanvasImageUrl(collection.mainImage.image_url);
    setEditorStep('editing');
  };

  const handleManage = (collection: CollectionGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForManage(collection);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Error loading collections</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Select Collection to Edit</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* Create New Collection Card */}
        <Card
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => setShowCreateDialog(true)}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center aspect-square">
            <Plus className="h-12 w-12 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">New Collection</span>
          </CardContent>
        </Card>

        {/* Collection Cards */}
        {(collections as CollectionGroup[])?.map((collection) => (
          <Card
            key={collection.id}
            className="cursor-pointer hover:border-primary transition-colors group relative"
            onClick={() => handleSelect(collection)}
          >
            <CardContent className="p-0">
              <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                {collection.thumbnail_url ? (
                  <img
                    src={collection.thumbnail_url}
                    alt={collection.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                {/* Overlay buttons */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => handleManage(collection, e)}
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    Manage
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => handleDelete(collection.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-3">
                <h3 className="font-medium truncate">{collection.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {collection.images?.length || 0} images
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Collection name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newCollectionName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Collection Dialog */}
      {selectedForManage && (
        <CollectionDetail
          collection={selectedForManage}
          open={!!selectedForManage}
          onOpenChange={(open) => !open && setSelectedForManage(null)}
          onSelectAndContinue={() => {
            // Refresh collection data and continue to editor
            const updated = (collections as CollectionGroup[])?.find(
              (c) => c.id === selectedForManage.id
            );
            if (updated?.mainImage) {
              setSelectedCollectionGroup(updated);
              setCanvasImageUrl(updated.mainImage.image_url);
              setEditorStep('editing');
            }
            setSelectedForManage(null);
          }}
        />
      )}
    </div>
  );
}
