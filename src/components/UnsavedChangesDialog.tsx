import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UnsavedChangesDialogProps {
  open: boolean;
  onDiscard: () => void;
  onContinue: () => void;
}

export function UnsavedChangesDialog({ open, onDiscard, onContinue }: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onContinue(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza que deseja sair?</AlertDialogTitle>
          <AlertDialogDescription>
            As informações não salvas serão perdidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onContinue}>Continuar editando</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
