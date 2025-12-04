import { supabase } from "@/integrations/supabase/client";
import { GenerateEmbeddingsResult } from "@/types/domain";

/**
 * Generate embeddings for legal sources that don't have them yet
 */
export async function generateEmbeddings(
  limit: number = 50
): Promise<GenerateEmbeddingsResult> {
  console.log(`[API] Generating embeddings for up to ${limit} sources`);
  
  const { data, error } = await supabase.functions.invoke('generate-embeddings', {
    body: { limit }
  });

  if (error) {
    console.error('[API] Failed to generate embeddings:', error);
    throw new Error(error.message || 'Kunde inte generera embeddings');
  }

  console.log(`[API] Updated ${data?.updated || 0} of ${data?.total || 0} sources`);
  
  return {
    updated: data?.updated || 0,
    total: data?.total || 0,
  };
}
