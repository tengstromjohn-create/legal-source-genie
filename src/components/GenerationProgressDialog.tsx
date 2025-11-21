import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SourceProgress {
  id: string;
  title: string;
  status: "pending" | "processing" | "completed" | "failed";
  requirementsCount?: number;
  error?: string;
}

interface GenerationProgressDialogProps {
  open: boolean;
  sources: SourceProgress[];
  currentIndex: number;
}

export const GenerationProgressDialog = ({
  open,
  sources,
  currentIndex,
}: GenerationProgressDialogProps) => {
  const progress = sources.length > 0 ? (currentIndex / sources.length) * 100 : 0;
  const completedCount = sources.filter(s => s.status === "completed").length;
  const failedCount = sources.filter(s => s.status === "failed").length;

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Genererar krav</DialogTitle>
          <DialogDescription>
            Analyserar {sources.length} lagrum och extraherar krav
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {completedCount} av {sources.length} analyserade
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {failedCount > 0 && (
            <div className="text-sm text-destructive">
              {failedCount} misslyckades
            </div>
          )}

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className={`p-3 rounded-lg border transition-all ${
                    source.status === "processing"
                      ? "border-primary bg-primary/5 animate-pulse"
                      : source.status === "completed"
                      ? "border-green-500/50 bg-green-500/5"
                      : source.status === "failed"
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {source.status === "processing" && (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                      {source.status === "completed" && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                      {source.status === "failed" && (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      {source.status === "pending" && (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2">
                        {source.title}
                      </p>
                      
                      {source.status === "completed" && source.requirementsCount !== undefined && (
                        <p className="text-xs text-green-600 mt-1">
                          {source.requirementsCount} krav extraherade
                        </p>
                      )}
                      
                      {source.status === "processing" && (
                        <p className="text-xs text-primary mt-1">
                          Analyserar...
                        </p>
                      )}
                      
                      {source.status === "failed" && source.error && (
                        <p className="text-xs text-destructive mt-1">
                          {source.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
