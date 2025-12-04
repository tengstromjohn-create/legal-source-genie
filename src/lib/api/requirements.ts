import { supabase } from "@/integrations/supabase/client";
import { Requirement, UpdateRequirementInput } from "@/types/domain";
import { mapRequirementRowsToRequirements, mapRequirementRowToRequirement, mapUpdateRequirementInputToRow } from "@/lib/domain";

/**
 * Fetch all requirements with their legal source info
 */
export async function fetchAllRequirements(workspaceId?: string | null): Promise<Requirement[]> {
  let query = supabase
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

  if (workspaceId) {
    query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return mapRequirementRowsToRequirements(data as any);
}

/**
 * Fetch requirements with pagination
 */
export async function fetchRequirementsPaginated(
  workspaceId: string | null | undefined,
  page: number,
  pageSize: number
): Promise<Requirement[]> {
  let query = supabase
    .from("requirement")
    .select(`
      *,
      legal_source:legal_source_id (
        title,
        regelverk_name,
        lagrum
      )
    `)
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (workspaceId) {
    query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return mapRequirementRowsToRequirements(data as any);
}

/**
 * Fetch requirements for a specific legal source
 */
export async function fetchRequirementsBySource(sourceId: string): Promise<Requirement[]> {
  const { data, error } = await supabase
    .from("requirement")
    .select("*")
    .eq("legal_source_id", sourceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return mapRequirementRowsToRequirements(data as any);
}

/**
 * Update a requirement and return the updated requirement
 */
export async function updateRequirement(id: string, updates: UpdateRequirementInput): Promise<Requirement> {
  const rowUpdates = mapUpdateRequirementInputToRow(updates);
  
  const { data, error } = await supabase
    .from("requirement")
    .update(rowUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRequirementRowToRequirement(data as any);
}

/**
 * Delete a requirement
 */
export async function deleteRequirement(id: string): Promise<void> {
  const { error } = await supabase
    .from("requirement")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
