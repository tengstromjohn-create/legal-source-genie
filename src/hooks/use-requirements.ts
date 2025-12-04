import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Requirement, UpdateRequirementInput } from "@/types/domain";
import {
  fetchAllRequirements,
  fetchRequirementsBySource,
  updateRequirement as apiUpdateRequirement,
  deleteRequirement as apiDeleteRequirement,
} from "@/lib/api/requirements";
import { useActiveWorkspaceId } from "@/hooks/use-workspaces";
import { logError, getUserFriendlyMessage } from "@/lib/error";

export type { Requirement, UpdateRequirementInput };

export function useRequirements() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const workspaceId = useActiveWorkspaceId();

  const { data: requirements, isLoading, error, refetch } = useQuery({
    queryKey: ["requirements", workspaceId],
    queryFn: async () => {
      try {
        return await fetchAllRequirements(workspaceId);
      } catch (err) {
        logError(err, { component: "useRequirements", action: "fetch", workspaceId });
        throw err;
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteRequirement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements", workspaceId] });
      toast({
        title: "Borttaget",
        description: "Kravet har tagits bort",
      });
    },
    onError: (error: Error) => {
      logError(error, { component: "useRequirements", action: "delete", workspaceId });
      toast({
        title: "Fel",
        description: getUserFriendlyMessage(error),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRequirementInput }) =>
      apiUpdateRequirement(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements", workspaceId] });
      toast({
        title: "Sparat",
        description: "Kravet har uppdaterats",
      });
    },
    onError: (error: Error) => {
      logError(error, { component: "useRequirements", action: "update", workspaceId });
      toast({
        title: "Fel",
        description: getUserFriendlyMessage(error),
        variant: "destructive",
      });
    },
  });

  return {
    requirements,
    isLoading,
    error,
    reload: refetch,
    deleteRequirement: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    updateRequirement: (id: string, updates: UpdateRequirementInput) =>
      updateMutation.mutateAsync({ id, updates }),
    isUpdating: updateMutation.isPending,
  };
}

export function useRequirementsBySource(sourceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requirements, isLoading, error, refetch } = useQuery({
    queryKey: ["requirements", sourceId],
    queryFn: async () => {
      try {
        return await fetchRequirementsBySource(sourceId!);
      } catch (err) {
        logError(err, { component: "useRequirementsBySource", action: "fetch", sourceId });
        throw err;
      }
    },
    enabled: !!sourceId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRequirementInput }) =>
      apiUpdateRequirement(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements", sourceId] });
      toast({
        title: "Sparat",
        description: "Kravet har uppdaterats",
      });
    },
    onError: (error: Error) => {
      logError(error, { component: "useRequirementsBySource", action: "update", sourceId });
      toast({
        title: "Fel",
        description: getUserFriendlyMessage(error),
        variant: "destructive",
      });
    },
  });

  return {
    requirements,
    isLoading,
    error,
    reload: refetch,
    updateRequirement: (id: string, updates: UpdateRequirementInput) =>
      updateMutation.mutate({ id, updates }),
    isUpdating: updateMutation.isPending,
  };
}
