import { useCallback, useRef, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface UseSwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  threshold?: number;
  edgeSize?: number;
}

export function useSwipeGesture({
  onSwipeRight,
  onSwipeLeft,
  threshold = 60,
  edgeSize = 30,
}: UseSwipeGestureOptions) {
  const isMobile = useIsMobile();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isMobile) return;
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      touchStartTime.current = Date.now();

      // Only allow swipe-right-to-open from the left edge
      isSwiping.current =
        (onSwipeRight && touch.clientX <= edgeSize) ||
        (onSwipeLeft && touch.clientX > edgeSize) ||
        false;
    },
    [isMobile, edgeSize, onSwipeRight, onSwipeLeft]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isMobile || !isSwiping.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;
      const elapsed = Date.now() - touchStartTime.current;

      // Must be mostly horizontal and fast enough (< 500ms)
      if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && elapsed < 500) {
        if (deltaX > threshold && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < -threshold && onSwipeLeft) {
          onSwipeLeft();
        }
      }

      isSwiping.current = false;
    },
    [isMobile, threshold, onSwipeRight, onSwipeLeft]
  );

  useEffect(() => {
    if (!isMobile) return;

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, handleTouchStart, handleTouchEnd]);
}
