import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Download } from 'lucide-react';

interface ImageViewerProps {
  imageUrl: string | null;
  altText?: string;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, altText = 'صورة', onClose }) => {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset state when URL changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsLoading(true);
    setHasError(false);
  }, [imageUrl]);

  // Prevent the underlying chat from scrolling while the full-screen viewer is open.
  useEffect(() => {
    if (!imageUrl) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [imageUrl]);

  // Keyboard Escape listener
  useEffect(() => {
    if (!imageUrl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Zoom helpers
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Double click / tap toggle zoom
  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2.2);
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.2, 4));
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.2, 1);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Mouse / Touch Dragging when scale > 1
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || scale <= 1 || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (!imageUrl) return null;

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label={altText}
      className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200"
      dir="rtl"
    >
      {/* Top Action Bar */}
      <div className="p-3 sm:p-4 flex items-center justify-between text-white bg-gradient-to-b from-black/80 to-transparent shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200 truncate max-w-[200px] sm:max-w-xs">
            {altText}
          </span>
          <span className="text-[10px] bg-slate-800 text-teal-300 px-2 py-0.5 rounded-full font-mono font-bold">
            {Math.round(scale * 100)}%
          </span>
        </div>

        {/* Zoom Controls & Close Button */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 4}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition active:scale-95"
            title="تكبير (+)"
          >
            <ZoomIn className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition active:scale-95"
            title="تصغير (-)"
          >
            <ZoomOut className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>

          {scale > 1 && (
            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-teal-300 transition active:scale-95 text-xs font-bold"
              title="إعادة ضبط الحجم"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <a
            href={imageUrl}
            download="darna_media_image.jpg"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-emerald-300 transition active:scale-95"
            title="تحميل الصورة"
          >
            <Download className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white transition active:scale-95 mr-1"
            title="إغلاق (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden p-2 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget && scale === 1) {
            onClose();
          }
        }}
      >
        {/* Loading Spinner */}
        {isLoading && !hasError && (
          <div className="absolute flex flex-col items-center gap-2 text-teal-400">
            <div className="w-8 h-8 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">جاري تحميل الصورة...</span>
          </div>
        )}

        {/* Error Fallback */}
        {hasError && (
          <div className="flex flex-col items-center gap-2 text-rose-400 p-6 bg-slate-900/80 rounded-2xl border border-rose-900/50 max-w-xs text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
            <span className="text-xs font-bold">تعذر تحميل الصورة لمرفق غير متاح أو منتهي الصلاحية</span>
          </div>
        )}

        {/* Render Image with CSS Transforms */}
        <img
          ref={imageRef}
          src={imageUrl}
          alt={altText}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          onDoubleClick={handleDoubleClick}
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          className={`max-h-[82vh] max-w-[95vw] object-contain rounded-lg shadow-2xl transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </div>

      {/* Bottom Information Tip */}
      <div className="p-3 text-center text-[11px] text-slate-400 bg-gradient-to-t from-black/80 to-transparent shrink-0">
        <span>انقر مرتين للتكبير • اسحب للتحريك • انقر خروج للإغلاق 🔍</span>
      </div>
    </div>,
    document.body
  );
};
