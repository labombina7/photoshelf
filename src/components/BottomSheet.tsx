'use client';

import { useRef, useState, type ReactNode } from 'react';

interface BottomSheetProps {
  children: ReactNode;
  onClose?: () => void;
}

export default function BottomSheet({ children, onClose }: BottomSheetProps) {
  const [closing, setClosing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  function handleClose() {
    if (!onClose) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 300);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = deltaY / elapsed; // px/ms

    if (deltaY > 80 || (deltaY > 20 && velocity > 0.3)) {
      handleClose();
    }
    touchStartY.current = null;
  }

  return (
    <>
      {/* Backdrop — only visible via CSS on mobile */}
      <div className="bottom-sheet-backdrop" onClick={handleClose} />

      <div
        className={`bottom-sheet${closing ? ' closing' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-content">
          {children}
        </div>
      </div>
    </>
  );
}
