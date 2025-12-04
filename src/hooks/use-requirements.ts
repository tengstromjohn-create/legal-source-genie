import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Requirement, UpdateRequirementInput } from "@/types/domain";
import {
  fetchAllRequirements,
  fetchRequirementsBySource,
  updateRequirement as apiUpdateRequirement,
  deleteRequirement as apiDeleteRequirement,
} from "@/lib/api/requirements";

export type { Requirement, UpdateRequirementInput };

export function useRequirements() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requirements, isLoading, error, refetch } = useQuery({
    queryKey: ["requirements"],
    queryFn: fetchAllRequirements,
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteRequirement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      toast({
        title: "Borttaget",
        description: "Kravet har tagits bort",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRequirementInput }) =>
      apiUpdateRequirement(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      toast({
        title: "Sparat",
        description: "Kravet har uppdaterats",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fel",
        description: error.message,
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
    queryFn: () => fetchRequirementsBySource(sourceId!),
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
      toast({
        title: "Fel",
        description: error.message,
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
