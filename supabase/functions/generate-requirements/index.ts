import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { LAW_SYSTEM_PROMPT } from "./prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Structured error response
interface ApiErrorResponse {
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
}

function createErrorResponse(
  errorCode: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): Response {
  const body: ApiErrorResponse = { errorCode, message };
  if (details) body.details = details;
  
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logWithContext(level: "info" | "error" | "warn", message: string, context: Record<string, unknown>) {
  const logData = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  
  if (level === "error") {
    console.error(JSON.stringify(logData));
  } else if (level === "warn") {
    console.warn(JSON.stringify(logData));
  } else {
    console.log(JSON.stringify(logData));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestContext: Record<string, unknown> = {
    function: "generate-requirements",
  };

  try {
    const { legal_source_id, workspace_id } = await req.json();
    requestContext.sourceId = legal_source_id;
    requestContext.workspaceId = workspace_id;

    if (!legal_source_id) {
      logWithContext("warn", "Missing legal_source_id", requestContext);
      return createErrorResponse("VALIDATION_ERROR", "legal_source_id is required", 400);
    }

    logWithContext("info", "Starting requirements generation", requestContext);

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
      logWithContext("error", "Legal source not found", { ...requestContext, dbError: fetchError });
      return createErrorResponse("NOT_FOUND", "Legal source not found", 404, { sourceId: legal_source_id });
    }

    requestContext.sourceTitle = source.title;
    logWithContext("info", "Legal source fetched", requestContext);

    // Limit text to 30000 characters to avoid timeout
    const fullText = source.full_text || source.content || '';
    const textToAnalyze = fullText.length > 30000 
      ? fullText.substring(0, 30000) + '\n\n[Text truncated due to length...]'
      : fullText;
    
    logWithContext("info", `Analyzing text`, { ...requestContext, originalLength: fullText.length, analyzedLength: textToAnalyze.length });

    // Build user prompt with legal source data
    const userPrompt = `
Regelverk: ${source.regelverk_name || source.title}
Lagrum: ${source.lagrum || ""}
Typ: ${source.typ || ""}
Referens: ${source.referens || ""}

Text:
${textToAnalyze}
    `.trim();

    // Call OpenAI to analyze the legal text
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      logWithContext("error", "OPENAI_API_KEY not configured", requestContext);
      return createErrorResponse("SERVER_ERROR", "AI service not configured", 500);
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-2025-08-07",
        messages: [
          { role: "system", content: LAW_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 16000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logWithContext("error", "OpenAI API error", { ...requestContext, status: aiResponse.status, response: errorText });
      
      if (aiResponse.status === 429) {
        return createErrorResponse("RATE_LIMIT", "För många förfrågningar. Försök igen senare.", 429);
      }
      
      if (aiResponse.status === 402) {
        return createErrorResponse("PAYMENT_REQUIRED", "Betalning krävs. Kontrollera OpenAI-kontot.", 402);
      }
      
      return createErrorResponse("AI_ERROR", "AI-tjänsten kunde inte bearbeta begäran", 500, { status: aiResponse.status });
    }

    const aiData = await aiResponse.json();
    logWithContext("info", "AI response received", requestContext);

    // Parse the JSON response from the AI
    const content = aiData.choices?.[0]?.message?.content || "";
    
    if (!content) {
      logWithContext("error", "No content in AI response", requestContext);
      return createErrorResponse("AI_ERROR", "Inget svar från AI", 500);
    }

    // Parse the JSON content
    let parsed;
    try {
      // Remove markdown code blocks if present
      let jsonContent = content.trim();
      
      // Check if wrapped in markdown code blocks
      if (jsonContent.startsWith('```')) {
        const match = jsonContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (match) {
          jsonContent = match[1].trim();
        } else {
          jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '');
        }
      }
      
      // Check if JSON appears to be truncated
      const trimmed = jsonContent.trim();
      if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
        logWithContext("error", "AI response appears truncated", { ...requestContext, contentLength: content.length });
        return createErrorResponse("PARSE_ERROR", "AI-svaret blev trunkat. Dokumentet kan vara för stort.", 422);
      }
      
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      logWithContext("error", "Failed to parse AI response", { 
        ...requestContext, 
        parseError: parseError instanceof Error ? parseError.message : "Unknown",
        contentPreview: content.substring(0, 500)
      });
      
      if (content.length > 5000) {
        return createErrorResponse("PARSE_ERROR", "Dokumentet är för stort och AI-svaret blev trunkat. Prova att dela upp dokumentet.", 422);
      }
      
      return createErrorResponse("PARSE_ERROR", "Kunde inte tolka AI-svaret", 422);
    }

    const krav = parsed.krav || [];
    logWithContext("info", `Extracted requirements`, { ...requestContext, count: krav.length });

    // Insert requirements into the database
    if (krav.length > 0) {
      const requirementsToInsert = krav.map((k: any) => ({
        legal_source_id,
        workspace_id: workspace_id || source.workspace_id || null,
        titel: k.titel,
        beskrivning: k.beskrivning,
        lagrum: k.paragraf || null,
        obligation: k.obligation || null,
        risknivå: k.risknivå || null,
        subjekt: k.subjekt || null,
        trigger: k.trigger || null,
        undantag: k.undantag || null,
        åtgärder: k.åtgärder || null,
        created_by: "ai",
        title: k.titel,
        description: k.beskrivning,
      }));

      const { error: insertError } = await supabase
        .from("requirement")
        .insert(requirementsToInsert);

      if (insertError) {
        logWithContext("error", "Error inserting requirements", { ...requestContext, dbError: insertError });
        return createErrorResponse("SERVER_ERROR", "Kunde inte spara krav till databasen", 500);
      }

      logWithContext("info", `Successfully inserted requirements`, { ...requestContext, count: krav.length });
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
    logWithContext("error", "Unhandled error in generate-requirements", {
      ...requestContext,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return createErrorResponse(
      "SERVER_ERROR",
      error instanceof Error ? error.message : "Ett oväntat fel uppstod",
      500
    );
  }
});
