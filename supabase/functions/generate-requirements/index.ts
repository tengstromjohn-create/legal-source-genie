import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { LAW_SYSTEM_PROMPT } from "./prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { legal_source_id } = await req.json();

    if (!legal_source_id) {
      throw new Error("legal_source_id is required");
    }

    console.log("Generating requirements for legal source:", legal_source_id);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the legal source
    const { data: source, error: fetchError } = await supabase
      .from("legal_source")
      .select("*")
      .eq("id", legal_source_id)
      .single();

    if (fetchError || !source) {
      throw new Error("Legal source not found");
    }

    console.log("Legal source fetched:", source.title);

    // Limit text to 30000 characters to avoid timeout
    const fullText = source.full_text || source.content || '';
    const textToAnalyze = fullText.length > 30000 
      ? fullText.substring(0, 30000) + '\n\n[Text truncated due to length...]'
      : fullText;
    
    console.log(`Analyzing ${textToAnalyze.length} characters (original: ${fullText.length})`);

    // Build user prompt with legal source data
    const userPrompt = `
Regelverk: ${source.regelverk_name || source.title}
Lagrum: ${source.lagrum || ""}
Typ: ${source.typ || ""}
Referens: ${source.referens || ""}

Text:
${textToAnalyze}
    `.trim();

    // Call Lovable AI to analyze the legal text
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: LAW_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { 
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable workspace." }),
          { 
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
      
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    // Parse the JSON response from the AI
    const content = aiData.choices?.[0]?.message?.content || "";
    
    if (!content) {
      console.error("No content in AI response");
      throw new Error("No content received from AI");
    }

    // Parse the JSON content
    let parsed;
    try {
      // Remove markdown code blocks if present
      let jsonContent = content.trim();
      
      // Check if wrapped in markdown code blocks
      if (jsonContent.startsWith('```')) {
        // Extract JSON from markdown code block
        const match = jsonContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (match) {
          jsonContent = match[1].trim();
        }
      }
      
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content.substring(0, 500));
      throw new Error("Invalid JSON response from AI");
    }

    const krav = parsed.krav || [];
    console.log(`Extracted ${krav.length} requirements`);

    // Insert requirements into the database
    if (krav.length > 0) {
      const requirementsToInsert = krav.map((k: any) => ({
        legal_source_id,
        titel: k.titel,
        beskrivning: k.beskrivning,
        obligation: k.obligation || null,
        risknivå: k.risknivå || null,
        subjekt: k.subjekt || null,
        trigger: k.trigger || null,
        undantag: k.undantag || null,
        åtgärder: k.åtgärder || null,
        created_by: "ai",
        // Keep legacy fields for backwards compatibility
        title: k.titel,
        description: k.beskrivning,
      }));

      const { error: insertError } = await supabase
        .from("requirement")
        .insert(requirementsToInsert);

      if (insertError) {
        console.error("Error inserting requirements:", insertError);
        throw new Error("Failed to save requirements to database");
      }

      console.log(`Successfully inserted ${krav.length} requirements`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: krav.length,
        requirements: krav,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-requirements function:", error);
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

