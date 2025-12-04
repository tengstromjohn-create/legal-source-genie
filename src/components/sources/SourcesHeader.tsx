import { useNavigate } from "react-router-dom";
import { Plus, FileText, Loader2, Sparkles, LogOut, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfUploadDialog } from "@/components/PdfUploadDialog";
import { RiksdagenImportDialog } from "@/components/RiksdagenImportDialog";

interface SourcesHeaderProps {
  isAdmin: boolean;
  sourcesCount: number;
  selectedCount: number;
  isGeneratingEmbeddings: boolean;
  isBatchGenerating: boolean;
  onGenerateEmbeddings: () => void;
  onToggleSelectAll: () => void;
  onBatchGenerate: () => void;
  onOpenForm: () => void;
  onSignOut: () => void;
}

export const SourcesHeader = ({
  isAdmin,
  sourcesCount,
  selectedCount,
  isGeneratingEmbeddings,
  isBatchGenerating,
  onGenerateEmbeddings,
  onToggleSelectAll,
  onBatchGenerate,
  onOpenForm,
  onSignOut,
}: SourcesHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Legal Sources</h1>
            <p className="text-muted-foreground mt-1">Manage and analyze legal documents</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && sourcesCount > 0 && (
              <>
                <Button 
                  onClick={onGenerateEmbeddings}
                  disabled={isGeneratingEmbeddings}
                  variant="outline"
                  className="gap-2"
                >
                  {isGeneratingEmbeddings ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Genererar embeddings...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Skapa Embeddings
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={onToggleSelectAll}
                  disabled={isBatchGenerating}
                  className="gap-2"
                >
                  {selectedCount === sourcesCount ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  Markera alla
                </Button>
                <Button 
                  onClick={onBatchGenerate}
                  disabled={selectedCount === 0 || isBatchGenerating}
                  className="gap-2"
                >
                  {isBatchGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Genererar ({selectedCount})...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generera Krav ({selectedCount})
                    </>
                  )}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => navigate("/requirements")} className="gap-2">
              <FileText className="h-4 w-4" />
              Visa Krav
            </Button>
            <Button variant="outline" onClick={() => navigate("/ask")} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Ställ fråga
            </Button>
            {isAdmin && (
              <>
                <RiksdagenImportDialog />
                <PdfUploadDialog />
                <Button onClick={onOpenForm} className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Source
                </Button>
              </>
            )}
            <Button variant="outline" onClick={onSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
