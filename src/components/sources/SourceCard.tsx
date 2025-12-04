import { Link } from "react-router-dom";
import { FileText, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LegalSource } from "@/hooks/use-legal-sources";

interface SourceCardProps {
  source: LegalSource;
  isAdmin: boolean;
  isSelected: boolean;
  isGenerating: boolean;
  isBatchGenerating: boolean;
  onToggleSelection: (sourceId: string) => void;
  onGenerateRequirements: (sourceId: string) => void;
}

export const SourceCard = ({
  source,
  isAdmin,
  isSelected,
  isGenerating,
  isBatchGenerating,
  onToggleSelection,
  onGenerateRequirements,
}: SourceCardProps) => {
  return (
    <Card className="h-full transition-all hover:shadow-lg hover:border-primary">
      <CardHeader>
        <div className="flex items-start gap-3">
          {isAdmin && (
            <Checkbox 
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(source.id)}
              disabled={isBatchGenerating}
              className="mt-1"
            />
          )}
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <Link to={`/sources/${source.id}`}>
              <CardTitle className="text-lg line-clamp-2 hover:text-primary cursor-pointer">
                {source.title}
              </CardTitle>
            </Link>
            <CardDescription className="mt-1">
              {new Date(source.created_at).toLocaleDateString()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {source.content}
        </p>
        {isAdmin && (
          <Button
            onClick={() => onGenerateRequirements(source.id)}
            disabled={isGenerating || isBatchGenerating}
            variant="outline"
            size="sm"
            className="w-full gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Genererar...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generera krav
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
