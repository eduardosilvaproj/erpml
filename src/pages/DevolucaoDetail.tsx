import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReturn } from "@/hooks/useDevolucoes";
import { ReturnConferenceTab } from "@/components/devolucoes/ReturnConferenceTab";

const DevolucaoDetail = () => {
  const { returnId } = useParams<{ returnId: string }>();
  const navigate = useNavigate();

  if (!returnId) {
    return <div className="text-center py-12 text-muted-foreground">ID da devolução não encontrado.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8 px-4 sm:px-0">
      <ReturnConferenceTab returnId={returnId} />
    </div>
  );
};

export default DevolucaoDetail;