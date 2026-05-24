import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RestoreDialogProps {
  open: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export const RestoreDialog = ({ open, onRestore, onDiscard }: RestoreDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>📋 Retomar nota em andamento?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Encontramos uma entrada de nota fiscal que não foi finalizada. Deseja continuar de onde parou?
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onDiscard}>Descartar</Button>
          <Button onClick={onRestore}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
