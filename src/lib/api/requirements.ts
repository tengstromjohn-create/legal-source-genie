import { supabase } from "@/integrations/supabase/client";
import { Requirement, UpdateRequirementInput } from "@/types/domain";
import { mapRequirementRowsToRequirements, mapUpdateRequirementInputToRow } from "@/lib/domain";

/**
 * Fetch all requirements with their legal source info
 */
export async function fetchAllRequirements(): Promise<Requirement[]> {
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
  return mapRequirementRowsToRequirements(data as any);
}

/**
 * Fetch requirements for a specific legal source
 */
export async function fetchRequirementsBySource(sourceId: string): Promise<Requirement[]> {
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
  return mapRequirementRowsToRequirements(data as any);
}

/**
 * Update a requirement
 */
export async function updateRequirement(id: string, updates: UpdateRequirementInput): Promise<void> {
  console.log("[API] Updating requirement:", id, updates);
  
  const rowUpdates = mapUpdateRequirementInputToRow(updates);
  
  const { error } = await supabase
    .from("requirement")
    .update(rowUpdates)
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
