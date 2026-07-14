import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Hook to manage unsaved changes confirmation for form dialogs.
 * 
 * Usage:
 * const { guardedClose, showConfirm, confirmDiscard, confirmContinue, markDirty, isDirty } = useUnsavedChanges();
 * 
 * Pass `guardedClose` as the `onOpenChange` to Dialog.
 * Render <UnsavedChangesDialog open={showConfirm} onDiscard={confirmDiscard} onContinue={confirmContinue} />
 */
export function useUnsavedChanges(onClose: (open: boolean) => void) {
  const [showConfirm, setShowConfirm] = useState(false);
  const dirtyRef = useRef(false);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const resetDirty = useCallback(() => {
    dirtyRef.current = false;
  }, []);

  const guardedClose = useCallback((open: boolean) => {
    if (!open && dirtyRef.current) {
      setShowConfirm(true);
      return;
    }
    dirtyRef.current = false;
    onClose(open);
  }, [onClose]);

  const confirmDiscard = useCallback(() => {
    dirtyRef.current = false;
    setShowConfirm(false);
    onClose(false);
  }, [onClose]);

  const confirmContinue = useCallback(() => {
    setShowConfirm(false);
  }, []);

  return {
    guardedClose,
    showConfirm,
    confirmDiscard,
    confirmContinue,
    markDirty,
    resetDirty,
    isDirty: dirtyRef.current,
  };
}
