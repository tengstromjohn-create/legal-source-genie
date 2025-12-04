import { supabase } from "@/integrations/supabase/client";
import { GenerateRequirementsResult } from "@/types/domain";

/**
 * Generate requirements from a legal source using AI
 */
export async function generateRequirementsForSource(
  sourceId: string
): Promise<GenerateRequirementsResult> {
  console.log(`[API] Generating requirements for source: ${sourceId}`);
  
  const { data, error } = await supabase.functions.invoke('generate-requirements', {
    body: { legal_source_id: sourceId }
  });

  if (error) {
    console.error('[API] Failed to generate requirements:', error);
    throw new Error(error.message || 'Kunde inte generera krav');
  }

  console.log(`[API] Generated ${data?.inserted || 0} requirements`);
  
  return {
    inserted: data?.inserted || 0,
    requirements: data?.requirements,
  };
}
