import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { Plant } from '@/types';
import { cn } from '@/lib/utils';

interface PlantsGalleryProps {
  plants: Plant[];
  selectedPlant: Plant | null;
  onSelect: (plant: Plant) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export default function PlantsGallery({
  plants,
  selectedPlant,
  onSelect,
  onDelete,
}: PlantsGalleryProps) {
  if (plants.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No plants yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add some plants to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {plants.map((plant) => (
        <div
          key={plant.id}
          className={cn(
            'relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all group',
            selectedPlant?.id === plant.id
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-transparent hover:border-primary/50'
          )}
          onClick={() => onSelect(plant)}
        >
          <img
            src={plant.image_url}
            alt={plant.name}
            className="w-full h-full object-cover"
          />

          {/* Name overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <p className="text-xs text-white truncate">{plant.name}</p>
          </div>

          {/* Delete button */}
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => onDelete(plant.id, e)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
