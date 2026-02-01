import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ImageCompareWiperProps {
  originalUrl: string;
  editedUrl: string;
  isActive?: boolean;
  alwaysActive?: boolean;
  className?: string;
}

export default function ImageCompareWiper({
  originalUrl,
  editedUrl,
  isActive = false,
  alwaysActive = false,
  className,
}: ImageCompareWiperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const active = alwaysActive || isActive;

  const updatePosition = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!active) return;
    setIsDragging(true);
    updatePosition(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!active) return;
    if (isDragging || alwaysActive) {
      updatePosition(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    if (!alwaysActive) {
      setPosition(50);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!active || !e.touches[0]) return;
    updatePosition(e.touches[0].clientX);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full overflow-hidden select-none cursor-ew-resize', className)}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
    >
      {/* Edited image (full) */}
      <img
        src={editedUrl}
        alt="Edited"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Original image (clipped from left) */}
      {active && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={originalUrl}
            alt="Original"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        </div>
      )}

      {/* Wiper line with handle */}
      {active && (
        <>
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] z-10"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            {/* Drag handle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-4 bg-gray-400 rounded" />
                <div className="w-0.5 h-4 bg-gray-400 rounded" />
              </div>
            </div>
          </div>
          {/* Labels */}
          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs z-10">
            Original
          </div>
          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs z-10">
            Result
          </div>
        </>
      )}
    </div>
  );
}
