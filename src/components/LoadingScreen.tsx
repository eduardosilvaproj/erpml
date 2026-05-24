import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

const LoadingScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full space-y-6 p-8">
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Carregando módulo...
        </p>
      </div>
      
      <div className="w-full max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
