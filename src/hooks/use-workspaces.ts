import { useWorkspace } from "@/contexts/WorkspaceContext";

// Re-export the hook for consistency with other hooks
export { useWorkspace };

// Hook to get just the active workspace ID for queries
export function useActiveWorkspaceId(): string | null {
  const { activeWorkspace } = useWorkspace();
  return activeWorkspace?.id ?? null;
}
