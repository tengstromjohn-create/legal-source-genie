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
    const { data: legalSource, error: fetchError } = await supabase
      .from("legal_source")
      .select("*")
      .eq("id", legal_source_id)
      .single();

    if (fetchError || !legalSource) {
      throw new Error("Legal source not found");
    }

    console.log("Legal source fetched:", legalSource.title);

    // Call Lovable AI to analyze the legal text
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a legal compliance expert. Analyze the provided legal document and extract key requirements. 
Return your response as a JSON array of requirements, where each requirement has:
- title: A clear, concise title for the requirement
- description: A detailed description of what is required

Focus on actionable compliance requirements, obligations, and responsibilities mentioned in the text.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze this legal document and extract requirements:\n\nTitle: ${legalSource.title}\n\nContent: ${legalSource.content}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_requirements",
              description: "Extract compliance requirements from the legal document",
              parameters: {
                type: "object",
                properties: {
                  requirements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["title", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["requirements"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_requirements" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    // Parse the tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("No tool call in AI response");
    }

    const parsedArgs = JSON.parse(toolCall.function.arguments);
    const requirements = parsedArgs.requirements || [];

    console.log(`Extracted ${requirements.length} requirements`);

    // Insert requirements into database
    const requirementsToInsert = requirements.map((req: any) => ({
      legal_source_id,
      title: req.title,
      description: req.description,
    }));

    const { data: insertedRequirements, error: insertError } = await supabase
      .from("requirement")
      .insert(requirementsToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting requirements:", insertError);
      throw insertError;
    }

    console.log(`Successfully inserted ${insertedRequirements?.length} requirements`);

    return new Response(
      JSON.stringify({
        success: true,
        count: insertedRequirements?.length || 0,
        requirements: insertedRequirements,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-requirements function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
