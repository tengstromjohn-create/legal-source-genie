import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Requirement {
  id: string;
  titel: string | null;
  title: string;
  beskrivning: string | null;
  description: string | null;
  lagrum: string | null;
  subjekt: string[] | null;
  trigger: string[] | null;
  undantag: string[] | null;
  obligation: string | null;
  åtgärder: string[] | null;
  risknivå: string | null;
  legal_source_id: string;
  created_at: string;
  created_by: string | null;
  legal_source?: {
    title: string;
    regelverk_name: string | null;
    lagrum: string | null;
  };
}

export interface RequirementUpdate {
  titel?: string;
  beskrivning?: string;
  obligation?: string;
  risknivå?: string;
  lagrum?: string;
  subjekt?: string[];
  trigger?: string[];
  undantag?: string[];
  åtgärder?: string[];
}

export function useRequirements() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requirements, isLoading, error, refetch } = useQuery({
    queryKey: ["requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirement")
        .select(`
          *,
          legal_source:legal_source_id (
            title,
            regelverk_name,
            lagrum
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Requirement[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("requirement")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
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
    mutationFn: async ({ id, updates }: { id: string; updates: RequirementUpdate }) => {
      const { error } = await supabase
        .from("requirement")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
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
    updateRequirement: (id: string, updates: RequirementUpdate) => 
      updateMutation.mutate({ id, updates }),
    isUpdating: updateMutation.isPending,
  };
}

export function useRequirementsBySource(sourceId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requirements, isLoading, error, refetch } = useQuery({
    queryKey: ["requirements", sourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirement")
        .select("*")
        .eq("legal_source_id", sourceId!)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!sourceId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: RequirementUpdate }) => {
      const { error } = await supabase
        .from("requirement")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements", sourceId] });
      toast({
        title: "Success",
        description: "Requirement updated successfully",
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

  return {
    requirements,
    isLoading,
    error,
    reload: refetch,
    updateRequirement: (id: string, updates: RequirementUpdate) =>
      updateMutation.mutate({ id, updates }),
    isUpdating: updateMutation.isPending,
  };
}
