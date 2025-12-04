import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LegalSource, CreateLegalSourceInput, GenerateRequirementsResult } from "@/types/domain";
import { mapSourceRowsToLegalSources, mapSourceRowToLegalSource, mapCreateSourceInputToRow } from "@/lib/domain";
import { generateRequirementsForSource, generateEmbeddings as generateEmbeddingsApi } from "@/lib/api";
import { useActiveWorkspaceId } from "@/hooks/use-workspaces";
import { logError, getUserFriendlyMessage } from "@/lib/error";

export type { LegalSource, CreateLegalSourceInput, GenerateRequirementsResult };

const PAGE_SIZE = 12;

// Cache configuration
const CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
};

export function useLegalSources() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const workspaceId = useActiveWorkspaceId();

  const { data: sources, isLoading, error, refetch } = useQuery({
    queryKey: ["legal_sources", workspaceId],
    queryFn: async (): Promise<LegalSource[]> => {
      let query = supabase
        .from("legal_source")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (workspaceId) {
        query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logError(error, { component: "useLegalSources", action: "fetch", workspaceId });
        throw error;
      }
      return mapSourceRowsToLegalSources(data);
    },
    ...CACHE_CONFIG,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateLegalSourceInput): Promise<LegalSource> => {
      const rowData = {
        ...mapCreateSourceInputToRow(input),
        workspace_id: workspaceId,
      };
      
      const { data, error } = await supabase
        .from("legal_source")
        .insert([rowData])
        .select()
        .single();
      
      if (error) {
        logError(error, { component: "useLegalSources", action: "create", workspaceId });
        throw error;
      }
      return mapSourceRowToLegalSource(data);
    },
    onSuccess: (newSource) => {
      // Optimistically update the cache instead of full refetch
      queryClient.setQueryData<LegalSource[]>(
        ["legal_sources", workspaceId],
        (old) => old ? [newSource, ...old] : [newSource]
      );
      toast({
        title: "Klart",
        description: "Rättskälla skapad",
      });
    },
    onError: (error: Error) => {
      logError(error, { component: "useLegalSources", action: "create", workspaceId });
      toast({
        title: "Fel",
        description: getUserFriendlyMessage(error),
        variant: "destructive",
      });
    },
  });

  const generateRequirements = async (sourceId: string): Promise<GenerateRequirementsResult> => {
    try {
      const result = await generateRequirementsForSource(sourceId, workspaceId);
      
      // Only invalidate requirements, not sources
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      
      return result;
    } catch (error) {
      logError(error, { component: "useLegalSources", action: "generateRequirements", sourceId, workspaceId });
      throw error;
    }
  };

  const generateEmbeddings = async (limit: number = 50) => {
    try {
      const result = await generateEmbeddingsApi(limit);
      
      queryClient.invalidateQueries({ queryKey: ["legal_sources", workspaceId] });
      
      return result;
    } catch (error) {
      logError(error, { component: "useLegalSources", action: "generateEmbeddings", workspaceId });
      throw error;
    }
  };

  return {
    sources,
    isLoading,
    error,
    reload: refetch,
    createSource: createMutation.mutate,
    isCreating: createMutation.isPending,
    generateRequirements,
    generateEmbeddings,
  };
}

// Paginated version for large lists
export function useLegalSourcesPaginated() {
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
    queryKey: ["legal_sources_paginated", workspaceId],
    queryFn: async ({ pageParam = 0 }): Promise<{ sources: LegalSource[]; nextPage: number | null }> => {
      let query = supabase
        .from("legal_source")
        .select("*")
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);
      
      if (workspaceId) {
        query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logError(error, { component: "useLegalSourcesPaginated", action: "fetch", workspaceId, page: pageParam });
        throw error;
      }

      const sources = mapSourceRowsToLegalSources(data);
      return {
        sources,
        nextPage: sources.length === PAGE_SIZE ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    ...CACHE_CONFIG,
  });

  // Flatten all pages into a single array
  const sources = data?.pages.flatMap((page) => page.sources) ?? [];

  return {
    sources,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    reload: refetch,
  };
}

export function useLegalSource(id: string | undefined) {
  const { data: source, isLoading, error } = useQuery({
    queryKey: ["legal_source", id],
    queryFn: async (): Promise<LegalSource> => {
      const { data, error } = await supabase
        .from("legal_source")
        .select("*")
        .eq("id", id!)
        .single();
      
      if (error) {
        logError(error, { component: "useLegalSource", action: "fetch", sourceId: id });
        throw error;
      }
      return mapSourceRowToLegalSource(data);
    },
    enabled: !!id,
    ...CACHE_CONFIG,
  });

  return {
    source,
    isLoading,
    error,
  };
}
