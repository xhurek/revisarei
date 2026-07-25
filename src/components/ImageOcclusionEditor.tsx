import React, { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export interface OcclusionRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AttachedImage {
  id: string;
  url: string;
  occlusions: OcclusionRect[];
}

interface ImageOcclusionEditorProps {
  image: AttachedImage;
  onUpdate: (image: AttachedImage) => void;
  onRemove: () => void;
  isOcclusionMode: boolean;
}

export const ImageOcclusionEditor: React.FC<ImageOcclusionEditorProps> = ({ image, onUpdate, onRemove, isOcclusionMode }: ImageOcclusionEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentDrawRect, setCurrentDrawRect] = useState<OcclusionRect | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, rectX: 0, rectY: 0 });

  const getPointerCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isOcclusionMode) return;
    const { x, y } = getPointerCoords(e);
    
    // Check if clicking on an existing rect to drag it
    const target = e.target as HTMLElement;
    if (target.closest('.occlusion-rect-handle')) {
      // It's a drag handle, let the handle logic take care of it
      return;
    }
    
    // Otherwise start drawing
    setIsDrawing(true);
    setDrawStart({ x, y });
    setCurrentDrawRect({ id: 'temp', x, y, w: 0, h: 0 });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isOcclusionMode) return;
    const { x, y } = getPointerCoords(e);
    
    if (isDrawing && currentDrawRect) {
      const minX = Math.min(x, drawStart.x);
      const minY = Math.min(y, drawStart.y);
      const w = Math.abs(x - drawStart.x);
      const h = Math.abs(y - drawStart.y);
      setCurrentDrawRect({ ...currentDrawRect, x: minX, y: minY, w, h });
    } else if (draggingId) {
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;
      
      const updatedOcclusions = image.occlusions.map(rect => {
        if (rect.id === draggingId) {
          const newX = Math.max(0, Math.min(100 - rect.w, dragStart.rectX + deltaX));
          const newY = Math.max(0, Math.min(100 - rect.h, dragStart.rectY + deltaY));
          return { ...rect, x: newX, y: newY };
        }
        return rect;
      });
      onUpdate({ ...image, occlusions: updatedOcclusions });
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && currentDrawRect) {
      if (currentDrawRect.w > 2 && currentDrawRect.h > 2) {
        onUpdate({
          ...image,
          occlusions: [...image.occlusions, { ...currentDrawRect, id: uuidv4() }]
        });
      }
      setIsDrawing(false);
      setCurrentDrawRect(null);
    }
    if (draggingId) {
      setDraggingId(null);
    }
  };

  const removeRect = (id: string) => {
    onUpdate({
      ...image,
      occlusions: image.occlusions.filter(r => r.id !== id)
    });
  };

  return (
    <div className="relative inline-block mt-2 group border border-slate-200 rounded-xl p-1 bg-white shadow-sm w-full max-w-full">
      <div 
        ref={containerRef}
        className={`relative inline-block w-full max-w-full overflow-hidden rounded-lg ${isOcclusionMode ? 'cursor-crosshair' : ''}`}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <img src={image.url} alt="Flashcard visual" className="w-full h-auto object-contain block pointer-events-none select-none" />
        
        {/* Render existing occlusions */}
        {image.occlusions.map(rect => (
          <div
            key={rect.id}
            style={{
              left: `${rect.x}%`,
              top: `${rect.y}%`,
              width: `${rect.w}%`,
              height: `${rect.h}%`,
            }}
            className="absolute bg-indigo-600 border-2 border-indigo-950 opacity-90 rounded"
          >
            {isOcclusionMode && (
              <>
                <div 
                  className="occlusion-rect-handle absolute inset-0 cursor-move"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const { x, y } = getPointerCoords(e);
                    setDraggingId(rect.id);
                    setDragStart({ x, y, rectX: rect.x, rectY: rect.y });
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const { x, y } = getPointerCoords(e);
                    setDraggingId(rect.id);
                    setDragStart({ x, y, rectX: rect.x, rectY: rect.y });
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeRect(rect.id); }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 z-10"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}

        {/* Render currently drawing occlusion */}
        {isDrawing && currentDrawRect && (
          <div
            style={{
              left: `${currentDrawRect.x}%`,
              top: `${currentDrawRect.y}%`,
              width: `${currentDrawRect.w}%`,
              height: `${currentDrawRect.h}%`,
            }}
            className="absolute bg-indigo-600/50 border-2 border-indigo-500 rounded"
          />
        )}
      </div>

      {!isOcclusionMode && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow transition"
          title="Remover Imagem"
        >
          &times;
        </button>
      )}
    </div>
  );
}
