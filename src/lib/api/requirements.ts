import { supabase } from "@/integrations/supabase/client";

export interface RequirementUpdate {
  titel?: string;
  beskrivning?: string;
  obligation?: string;
  risknivå?: string;
  subjekt?: string[];
  trigger?: string[];
  undantag?: string[];
  åtgärder?: string[];
}

export interface RequirementRow {
  id: string;
  titel: string | null;
  title: string;
  beskrivning: string | null;
  description: string | null;
  subjekt: any;
  trigger: any;
  undantag: any;
  obligation: string | null;
  åtgärder: any;
  risknivå: string | null;
  legal_source_id: string;
  created_at: string;
  created_by: string | null;
}

export interface RequirementWithSource extends RequirementRow {
  legal_source?: {
    title: string;
    regelverk_name: string | null;
    lagrum: string | null;
  };
}

/**
 * Fetch all requirements with their legal source info
 */
export async function fetchAllRequirements(): Promise<RequirementWithSource[]> {
  console.log("[API] Fetching all requirements");
  
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

  if (error) {
    console.error("[API] Error fetching requirements:", error);
    throw new Error(error.message);
  }

  console.log("[API] Fetched", data?.length || 0, "requirements");
  return data as unknown as RequirementWithSource[];
}

/**
 * Fetch requirements for a specific legal source
 */
export async function fetchRequirementsBySource(sourceId: string): Promise<RequirementRow[]> {
  console.log("[API] Fetching requirements for source:", sourceId);
  
  const { data, error } = await supabase
    .from("requirement")
    .select("*")
    .eq("legal_source_id", sourceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[API] Error fetching requirements by source:", error);
    throw new Error(error.message);
  }

  console.log("[API] Fetched", data?.length || 0, "requirements for source");
  return data;
}

/**
 * Update a requirement
 */
export async function updateRequirement(id: string, updates: RequirementUpdate): Promise<void> {
  console.log("[API] Updating requirement:", id, updates);
  
  const { error } = await supabase
    .from("requirement")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[API] Error updating requirement:", error);
    throw new Error(error.message);
  }

  console.log("[API] Requirement updated successfully");
}

/**
 * Delete a requirement
 */
export async function deleteRequirement(id: string): Promise<void> {
  console.log("[API] Deleting requirement:", id);
  
  const { error } = await supabase
    .from("requirement")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[API] Error deleting requirement:", error);
    throw new Error(error.message);
  }

  console.log("[API] Requirement deleted successfully");
}
