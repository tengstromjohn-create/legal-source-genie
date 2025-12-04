import { supabase } from "@/integrations/supabase/client";
import { AskQuestionResult } from "@/types/domain";

/**
 * Ask a legal question and get an AI-generated answer based on relevant legal sources
 */
export async function askLegalQuestion(
  question: string
): Promise<AskQuestionResult> {
  console.log(`[API] Asking legal question: "${question.substring(0, 50)}..."`);
  
  const { data, error } = await supabase.functions.invoke('ask-legal-question', {
    body: { question }
  });

  if (error) {
    console.error('[API] Failed to ask question:', error);
    throw new Error(error.message || 'Kunde inte besvara frågan');
  }

  console.log(`[API] Got answer with ${data?.matches?.length || 0} matches`);
  
  return {
    answer: data?.answer || '',
    matches: data?.matches || [],
  };
}
