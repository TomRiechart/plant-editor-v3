import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, PencilBrush, FabricImage } from 'fabric';
import { useEditorStore } from '@/stores/editorStore';
import { BRUSH_COLORS } from '@/types';
import { Loader2 } from 'lucide-react';

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const {
    canvasImageUrl,
    drawingState,
    currentBrushColor,
  } = useEditorStore();

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      isDrawingMode: true,
      selection: false,
    });

    fabricRef.current = canvas;

    // Set up brush
    const brush = new PencilBrush(canvas);
    brush.color = BRUSH_COLORS[currentBrushColor];
    brush.width = drawingState.brushSize;
    canvas.freeDrawingBrush = brush;

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !fabricRef.current) return;
      // Canvas will be resized when image loads
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  // Update brush color
  useEffect(() => {
    if (!fabricRef.current) return;
    const brush = fabricRef.current.freeDrawingBrush;
    if (brush) {
      brush.color = BRUSH_COLORS[currentBrushColor];
    }
  }, [currentBrushColor]);

  // Update brush size
  useEffect(() => {
    if (!fabricRef.current) return;
    const brush = fabricRef.current.freeDrawingBrush;
    if (brush) {
      brush.width = drawingState.brushSize;
    }
  }, [drawingState.brushSize]);

  // Load image
  useEffect(() => {
    if (!canvasImageUrl || !fabricRef.current || !containerRef.current) return;

    setIsLoading(true);

    FabricImage.fromURL(canvasImageUrl, { crossOrigin: 'anonymous' })
      .then((img) => {
        const canvas = fabricRef.current!;
        const container = containerRef.current!;

        // Calculate dimensions to fit container while maintaining aspect ratio
        const maxWidth = container.clientWidth - 32;
        const maxHeight = container.clientHeight - 32;

        const imgWidth = img.width || 800;
        const imgHeight = img.height || 600;

        const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
        const canvasWidth = Math.floor(imgWidth * scale);
        const canvasHeight = Math.floor(imgHeight * scale);

        // Set canvas dimensions
        canvas.setDimensions({ width: canvasWidth, height: canvasHeight });

        // Scale and center image
        img.scale(scale);
        img.set({
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
        });

        // Clear and add background image
        canvas.clear();
        canvas.backgroundImage = img;
        canvas.renderAll();

        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error loading image:', error);
        setIsLoading(false);
      });
  }, [canvasImageUrl]);

  // Get canvas data URL for generation
  const getCanvasDataUrl = useCallback(() => {
    if (!fabricRef.current) return null;
    return fabricRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });
  }, []);

  // Expose method to parent
  useEffect(() => {
    (window as any).getCanvasDataUrl = getCanvasDataUrl;
    return () => {
      delete (window as any).getCanvasDataUrl;
    };
  }, [getCanvasDataUrl]);

  // Clear drawings
  const clearDrawings = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const bg = canvas.backgroundImage;
    canvas.clear();
    if (bg) {
      canvas.backgroundImage = bg;
    }
    canvas.renderAll();
  }, []);

  // Undo last stroke
  const undoLastStroke = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const objects = canvas.getObjects();
    if (objects.length > 0) {
      canvas.remove(objects[objects.length - 1]);
      canvas.renderAll();
    }
  }, []);

  // Expose methods
  useEffect(() => {
    (window as any).clearCanvasDrawings = clearDrawings;
    (window as any).undoCanvasStroke = undoLastStroke;
    return () => {
      delete (window as any).clearCanvasDrawings;
      delete (window as any).undoCanvasStroke;
    };
  }, [clearDrawings, undoLastStroke]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div className="rounded-lg overflow-hidden shadow-lg border">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
