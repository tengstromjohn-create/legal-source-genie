import { ParsePdfResult, ParsePdfInput } from "@/types/domain";

/**
 * Parse a legal PDF and extract legal sources
 * Uses direct fetch because FormData file uploads require it
 */
export async function parseLegalPdf(
  input: ParsePdfInput
): Promise<ParsePdfResult> {
  console.log(`[API] Parsing PDF: ${input.file.name}`);
  
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("regelverk_name", input.regelverkName);
  formData.append("typ", input.typ);
  if (input.referens) {
    formData.append("referens", input.referens);
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/parse-legal-pdf`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[API] Failed to parse PDF:', errorData);
    throw new Error(errorData.error || 'Kunde inte parsa PDF');
  }

  const data = await response.json();
  
  console.log(`[API] Parsed PDF: ${data.inserted} sources from ${data.processedPages} pages`);
  
  return {
    inserted: data.inserted || 0,
    pages: data.pages || 0,
    processedPages: data.processedPages || 0,
  };
}
