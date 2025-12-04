import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

export function WorkspaceSelector() {
  const { workspaces, activeWorkspace, setActiveWorkspace, isLoading } = useWorkspace();

  if (isLoading || workspaces.length === 0) {
    return null;
  }

  // Don't show selector if only one workspace
  if (workspaces.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="truncate max-w-[150px]">{activeWorkspace?.name}</span>
      </div>
    );
  }

  return (
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
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Välj arbetsyta" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-50">
        {workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
