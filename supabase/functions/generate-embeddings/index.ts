import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 50 } = await req.json();

    console.log(`Generating embeddings for up to ${limit} sources`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Lovable API key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch sources without embeddings
    const { data: sources, error: fetchError } = await supabase
      .from("legal_source")
      .select("id, full_text, content")
      .is("embedding", null)
      .limit(limit);

    if (fetchError) {
      console.error("Error fetching sources:", fetchError);
      throw new Error("Failed to fetch legal sources");
    }

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: "No sources need embeddings" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${sources.length} sources`);

    // Generate embeddings for each source
    let updated = 0;
    const errors = [];

    for (const source of sources) {
      try {
        const textToEmbed = source.full_text || source.content;
        
        if (!textToEmbed || textToEmbed.trim().length === 0) {
          console.log(`Skipping source ${source.id} - no text content`);
          continue;
        }

        // Truncate text if too long (OpenAI limit is ~8000 tokens, roughly 32000 chars)
        const truncatedText = textToEmbed.length > 32000 
          ? textToEmbed.substring(0, 32000)
          : textToEmbed;

        // Call Lovable AI embeddings API
        const embeddingResponse = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: truncatedText,
          }),
        });

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error(`Lovable AI error for source ${source.id}:`, embeddingResponse.status, errorText);
          errors.push({ id: source.id, error: `Lovable AI error: ${embeddingResponse.status}` });
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Update the source with the embedding
        const { error: updateError } = await supabase
          .from("legal_source")
          .update({ embedding })
          .eq("id", source.id);

        if (updateError) {
          console.error(`Error updating source ${source.id}:`, updateError);
          errors.push({ id: source.id, error: updateError.message });
          continue;
        }

        updated++;
        console.log(`Updated source ${source.id} (${updated}/${sources.length})`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing source ${source.id}:`, error);
        errors.push({ 
          id: source.id, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        total: sources.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-embeddings function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
