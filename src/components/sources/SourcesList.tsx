import { FileText, Loader2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SourceCard } from "./SourceCard";
import { LegalSource } from "@/hooks/use-legal-sources";

interface SourcesListProps {
  sources: LegalSource[] | undefined;
  isLoading: boolean;
  isAdmin: boolean;
  selectedSources: Set<string>;
  generatingId: string | null;
  isBatchGenerating: boolean;
  onToggleSelection: (sourceId: string) => void;
  onGenerateRequirements: (sourceId: string) => void;
  onOpenForm: () => void;
}

export const SourcesList = ({
  sources,
  isLoading,
  isAdmin,
  selectedSources,
  generatingId,
  isBatchGenerating,
  onToggleSelection,
  onGenerateRequirements,
  onOpenForm,
}: SourcesListProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sources || sources.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No legal sources yet</h3>
          <p className="text-muted-foreground mb-4">
            {isAdmin 
              ? "Create your first legal source to get started"
              : "No legal sources available. Contact an administrator."}
          </p>
          {isAdmin && (
            <Button onClick={onOpenForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Source
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sources.map((source) => (
        <SourceCard
          key={source.id}
          source={source}
          isAdmin={isAdmin}
          isSelected={selectedSources.has(source.id)}
          isGenerating={generatingId === source.id}
          isBatchGenerating={isBatchGenerating}
          onToggleSelection={onToggleSelection}
          onGenerateRequirements={onGenerateRequirements}
        />
      ))}
    </div>
  );
};
