import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useState } from "react";

function isDemoWorkspace(name: string): boolean {
  return name.startsWith("Demo:");
}

export function DemoBanner() {
  const { activeWorkspace } = useWorkspace();
  const [dismissed, setDismissed] = useState(false);

  if (!activeWorkspace || !isDemoWorkspace(activeWorkspace.name) || dismissed) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <FlaskConical className="h-4 w-4" />
          <span className="text-sm font-medium">
            Du arbetar i en demo-arbetsyta. Data här är fiktiv och avsedd för demonstration.
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setDismissed(true)}
          className="h-6 w-6 p-0 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
