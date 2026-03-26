import { useState, useCallback, useRef, useEffect } from 'react';

export function useResizablePanel({
  initialWidth,
  minWidth,
  maxWidth,
  collapsed,
  onWidthChange,
  direction = 'right',
}) {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(initialWidth);

  const handleMouseDown = useCallback(
    (e) => {
      if (collapsed) return;
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = initialWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [collapsed, initialWidth]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startXRef.current;
      let newWidth;

      if (direction === 'right') {
        newWidth = startWidthRef.current - deltaX;
      } else {
        newWidth = startWidthRef.current + deltaX;
      }

      const clampedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
      onWidthChange(clampedWidth);
    },
    [isResizing, minWidth, maxWidth, onWidthChange, direction]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    isResizing,
    handleMouseDown,
  };
}
