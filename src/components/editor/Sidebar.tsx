import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { usePlants, useCreatePlant, useDeletePlant } from '@/hooks/usePlants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { Plant, BrushColor } from '@/types';
import { cn } from '@/lib/utils';
import { BRUSH_COLORS_SOLID } from '@/types';
import PlantsGallery from './PlantsGallery';

export default function Sidebar() {
  const {
    editorMode,
    setEditorMode,
    selectedPlant,
    setSelectedPlant,
    multiPlantSelections,
    addMultiPlantSelection,
    removeMultiPlantSelection,
    currentBrushColor,
    setCurrentBrushColor,
    clearMultiPlantSelections,
  } = useEditorStore();

  const { data: plants, isLoading } = usePlants();
  const createPlant = useCreatePlant();
  const deletePlant = useDeletePlant();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantFile, setNewPlantFile] = useState<File | null>(null);

  const handleModeChange = (checked: boolean) => {
    setEditorMode(checked ? 'multi' : 'single');
    if (!checked) {
      clearMultiPlantSelections();
    }
  };

  const handlePlantSelect = (plant: Plant) => {
    if (editorMode === 'single') {
      setSelectedPlant(plant);
    } else {
      // In multi mode, assign to current brush color
      addMultiPlantSelection(plant, currentBrushColor);
    }
  };

  const handleAddPlant = async () => {
    if (!newPlantName.trim() || !newPlantFile) return;

    try {
      await createPlant.mutateAsync({
        name: newPlantName,
        imageFile: newPlantFile,
      });
      setNewPlantName('');
      setNewPlantFile(null);
      setShowAddDialog(false);
    } catch (error) {
      console.error('Error creating plant:', error);
    }
  };

  const handleDeletePlant = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this plant?')) {
      await deletePlant.mutateAsync(id);
    }
  };

  const getColorSelection = (color: BrushColor) => {
    return multiPlantSelections.find((s) => s.color === color);
  };

  return (
    <div className="w-72 border-r bg-card flex flex-col h-full">
      {/* Mode Toggle */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <Label htmlFor="mode-toggle" className="text-sm font-medium">
            Multi-Plant Mode
          </Label>
          <Switch
            id="mode-toggle"
            checked={editorMode === 'multi'}
            onCheckedChange={handleModeChange}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {editorMode === 'single'
            ? 'Select one plant to replace'
            : 'Select up to 3 plants with different colors'}
        </p>
      </div>

      {/* Multi-plant color selections */}
      {editorMode === 'multi' && (
        <div className="p-4 border-b space-y-2">
          {(['red', 'blue', 'yellow'] as BrushColor[]).map((color) => {
            const selection = getColorSelection(color);
            return (
              <div
                key={color}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                  currentBrushColor === color
                    ? 'bg-accent'
                    : 'hover:bg-accent/50'
                )}
                onClick={() => setCurrentBrushColor(color)}
              >
                <div
                  className="w-6 h-6 rounded-full border-2"
                  style={{ backgroundColor: BRUSH_COLORS_SOLID[color] }}
                />
                <div className="flex-1 min-w-0">
                  {selection ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={selection.plant.image_url}
                        alt={selection.plant.name}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <span className="text-sm truncate">{selection.plant.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMultiPlantSelection(color);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Click to select {color} plant
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plants Gallery */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Plants</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PlantsGallery
              plants={(plants as Plant[]) || []}
              selectedPlant={editorMode === 'single' ? selectedPlant : null}
              onSelect={handlePlantSelect}
              onDelete={handleDeletePlant}
            />
          )}
        </div>
      </div>

      {/* Add Plant Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Plant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plant-name">Plant Name</Label>
              <Input
                id="plant-name"
                placeholder="e.g., Monstera"
                value={newPlantName}
                onChange={(e) => setNewPlantName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plant-image">Plant Image</Label>
              <Input
                id="plant-image"
                type="file"
                accept="image/*"
                onChange={(e) => setNewPlantFile(e.target.files?.[0] || null)}
              />
            </div>
            {newPlantFile && (
              <div className="aspect-square w-32 rounded-lg overflow-hidden bg-muted">
                <img
                  src={URL.createObjectURL(newPlantFile)}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPlant}
              disabled={!newPlantName.trim() || !newPlantFile || createPlant.isPending}
            >
              {createPlant.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Plant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
