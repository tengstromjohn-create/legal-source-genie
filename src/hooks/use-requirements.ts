import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Requirement, UpdateRequirementInput } from "@/types/domain";
import {
  fetchAllRequirements,
  fetchRequirementsBySource,
  fetchRequirementsPaginated,
  updateRequirement as apiUpdateRequirement,
  deleteRequirement as apiDeleteRequirement,
} from "@/lib/api/requirements";
import { useActiveWorkspaceId } from "@/hooks/use-workspaces";
import { logError, getUserFriendlyMessage } from "@/lib/error";

export type { Requirement, UpdateRequirementInput };

const PAGE_SIZE = 20;

// Cache configuration
const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
};

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
    ...CACHE_CONFIG,
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteRequirement,
    onSuccess: (_, deletedId) => {
      // Optimistically update cache
      queryClient.setQueryData<Requirement[]>(
        ["requirements", workspaceId],
        (old) => old?.filter(r => r.id !== deletedId) ?? []
      );
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
    onSuccess: (updatedReq, { id }) => {
      // Optimistically update cache
      queryClient.setQueryData<Requirement[]>(
        ["requirements", workspaceId],
        (old) => {
          if (!old) return [updatedReq];
          return old.map(r => r.id === id ? updatedReq : r);
        }
      );
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

// Paginated version with infinite scroll
export function useRequirementsPaginated() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const workspaceId = useActiveWorkspaceId();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["requirements_paginated", workspaceId],
    queryFn: async ({ pageParam = 0 }): Promise<{ requirements: Requirement[]; nextPage: number | null }> => {
      try {
        const requirements = await fetchRequirementsPaginated(workspaceId, pageParam, PAGE_SIZE);
        return {
          requirements,
          nextPage: requirements.length === PAGE_SIZE ? pageParam + 1 : null,
        };
      } catch (err) {
        logError(err, { component: "useRequirementsPaginated", action: "fetch", workspaceId, page: pageParam });
        throw err;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    ...CACHE_CONFIG,
  });

  // Flatten all pages
  const requirements = data?.pages.flatMap((page) => page.requirements) ?? [];

  const deleteMutation = useMutation({
    mutationFn: apiDeleteRequirement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements_paginated", workspaceId] });
      toast({
        title: "Borttaget",
        description: "Kravet har tagits bort",
      });
    },
    onError: (error: Error) => {
      logError(error, { component: "useRequirementsPaginated", action: "delete", workspaceId });
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
      queryClient.invalidateQueries({ queryKey: ["requirements_paginated", workspaceId] });
      toast({
        title: "Sparat",
        description: "Kravet har uppdaterats",
      });
    },
    onError: (error: Error) => {
      logError(error, { component: "useRequirementsPaginated", action: "update", workspaceId });
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
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
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
    ...CACHE_CONFIG,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRequirementInput }) =>
      apiUpdateRequirement(id, updates),
    onSuccess: (updatedReq, { id }) => {
      queryClient.setQueryData<Requirement[]>(
        ["requirements", sourceId],
        (old) => {
          if (!old) return [updatedReq];
          return old.map(r => r.id === id ? updatedReq : r);
        }
      );
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
