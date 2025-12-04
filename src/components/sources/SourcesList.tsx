import { FileText, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SourceCard } from "./SourceCard";
import { SourcesListSkeleton } from "@/components/ui/skeletons";
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
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
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
  hasMore,
  onLoadMore,
  isLoadingMore,
}: SourcesListProps) => {
  if (isLoading) {
    return <SourcesListSkeleton count={6} />;
  }

  if (!sources || sources.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Inga rättskällor ännu</h3>
          <p className="text-muted-foreground mb-4 text-center">
            {isAdmin 
              ? "Skapa din första rättskälla för att komma igång"
              : "Inga rättskällor tillgängliga. Kontakta en administratör."}
          </p>
          {isAdmin && (
            <Button onClick={onOpenForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Skapa källa
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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

      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Laddar..." : "Visa fler"}
          </Button>
        </div>
      )}
    </div>
  );
};
