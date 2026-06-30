import { useCallback, useRef } from 'react';

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

interface UseClassificarRowPressOptions {
  onLongPress: () => void;
  onShortPress: () => void;
}

export function useClassificarRowPress({
  onLongPress,
  onShortPress,
}: UseClassificarRowPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      longPressFiredRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        longPressFiredRef.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [clearTimer, onLongPress]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (timerRef.current === null) return;
      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearTimer();
    },
    [clearTimer]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      clearTimer();
      if (!longPressFiredRef.current) {
        onShortPress();
      }
      longPressFiredRef.current = false;
    },
    [clearTimer, onShortPress]
  );

  const onPointerCancel = useCallback(() => {
    clearTimer();
    longPressFiredRef.current = false;
  }, [clearTimer]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave: onPointerCancel,
  };
}
