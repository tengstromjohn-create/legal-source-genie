import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

export type LegalSource = Tables<"legal_source">;

export interface CreateLegalSourceInput {
  title: string;
  content: string;
  full_text?: string;
  regelverk_name?: string | null;
  lagrum?: string | null;
  typ?: string | null;
  referens?: string | null;
}

export interface GenerateRequirementsResult {
  inserted: number;
  requirements?: any[];
}

export function useLegalSources() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sources, isLoading, error, refetch } = useQuery({
    queryKey: ["legal_sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_source")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newSource: CreateLegalSourceInput) => {
      const { data, error } = await supabase
        .from("legal_source")
        .insert([{
          ...newSource,
          full_text: newSource.full_text || newSource.content,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal_sources"] });
      toast({
        title: "Success",
        description: "Legal source created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateRequirements = async (sourceId: string): Promise<GenerateRequirementsResult> => {
    const { data, error } = await supabase.functions.invoke('generate-requirements', {
      body: { legal_source_id: sourceId }
    });

    if (error) throw error;
    
    queryClient.invalidateQueries({ queryKey: ["legal_sources"] });
    queryClient.invalidateQueries({ queryKey: ["requirements"] });
    
    return {
      inserted: data?.inserted || 0,
      requirements: data?.requirements,
    };
  };

  const generateEmbeddings = async (limit: number = 50) => {
    const { data, error } = await supabase.functions.invoke('generate-embeddings', {
      body: { limit }
    });

    if (error) throw error;

    queryClient.invalidateQueries({ queryKey: ["legal_sources"] });
    
    return {
      updated: data?.updated || 0,
      total: data?.total || 0,
    };
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

export function useLegalSource(id: string | undefined) {
  const { data: source, isLoading, error } = useQuery({
    queryKey: ["legal_source", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_source")
        .select("*")
        .eq("id", id!)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  return {
    source,
    isLoading,
    error,
  };
}
