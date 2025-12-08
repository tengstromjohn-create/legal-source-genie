import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DEMO_WORKSPACE_NAME } from "@/lib/demo-data";

function isDemoWorkspace(name: string): boolean {
  return name.startsWith("Demo:");
}

export function WorkspaceSelector() {
  const { workspaces, activeWorkspace, setActiveWorkspace, isLoading } = useWorkspace();

  if (isLoading || workspaces.length === 0) {
    return null;
  }

  const isDemo = activeWorkspace && isDemoWorkspace(activeWorkspace.name);

  // Don't show selector if only one workspace
  if (workspaces.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
        {isDemo ? (
          <FlaskConical className="h-4 w-4 text-amber-500" />
        ) : (
          <Building2 className="h-4 w-4" />
        )}
        <span className="truncate max-w-[150px]">{activeWorkspace?.name}</span>
        {isDemo && (
          <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
            Demo
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={activeWorkspace?.id || ""}
        onValueChange={(value) => {
          const workspace = workspaces.find((w) => w.id === value);
          if (workspace) {
            setActiveWorkspace(workspace);
          }
        }}
      >
        <SelectTrigger className="w-[180px] h-9 bg-background border-border">
          <div className="flex items-center gap-2">
            {isDemo ? (
              <FlaskConical className="h-4 w-4 text-amber-500" />
            ) : (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            )}
            <SelectValue placeholder="Välj arbetsyta" />
          </div>
        </SelectTrigger>
        <SelectContent className="bg-popover border-border z-50">
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              <div className="flex items-center gap-2">
                {isDemoWorkspace(workspace.name) && (
                  <FlaskConical className="h-3 w-3 text-amber-500" />
                )}
                <span>{workspace.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isDemo && (
        <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
          Demo
        </Badge>
      )}
    </div>
  );
}
