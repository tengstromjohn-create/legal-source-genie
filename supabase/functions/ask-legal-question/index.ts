import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestContext: Record<string, unknown> = {
    function: "ask-legal-question",
  };

  try {
    const { question, workspace_id } = await req.json();
    requestContext.workspaceId = workspace_id;

    if (!question) {
      logWithContext("warn", "Missing question parameter", requestContext);
      return createErrorResponse("VALIDATION_ERROR", "Fråga (question) saknas", 400);
    }

    requestContext.questionLength = question.length;
    logWithContext("info", "Processing legal question", requestContext);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      logWithContext("error", "OPENAI_API_KEY not configured", requestContext);
      return createErrorResponse("SERVER_ERROR", "AI-tjänsten är inte konfigurerad", 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    logWithContext("info", "Generating embedding for question", requestContext);

    // 1) Create embedding for the question
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: question,
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      logWithContext("error", "OpenAI embedding error", { ...requestContext, status: embeddingResponse.status, response: errorText });
      
      if (embeddingResponse.status === 429) {
        return createErrorResponse("RATE_LIMIT", "För många förfrågningar. Försök igen senare.", 429);
      }
      
      return createErrorResponse("AI_ERROR", "Kunde inte skapa embedding", 500);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    logWithContext("info", "Searching for relevant legal sources", requestContext);

    // 2) Find relevant legal texts using RPC function
    const { data: matches, error } = await supabase.rpc('match_legal_sources', {
      query_embedding: queryEmbedding,
      match_count: 5,
      match_threshold: 0.5,
    });

    if (error) {
      logWithContext("error", "Database search error", { ...requestContext, dbError: error });
      return createErrorResponse("SERVER_ERROR", "Sökfel i databasen", 500);
    }

    if (!matches || matches.length === 0) {
      logWithContext("info", "No matching sources found", requestContext);
      return new Response(
        JSON.stringify({
          answer: 'Inga relevanta lagrum hittades för din fråga. Försök omformulera frågan eller kontrollera att lagtexter har laddats upp och fått embeddings.',
          matches: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logWithContext("info", `Found relevant sources`, { ...requestContext, matchCount: matches.length });

    // 3) Build context from matches
    const contextText = matches
      .map((m: any) => 
        `Lagrum: ${m.lagrum || 'Ej angiven'}\nTitel: ${m.title}\n\nText:\n${m.content}\n-----------------`
      )
      .join('\n\n');

    const prompt = `
Du är en juridiskt tränad assistent. 
Besvara frågan nedan ENDAST baserat på den givna lagtexten.

Lagtext:
${contextText}

Fråga:
${question}

Svara tydligt, på svenska, och hänvisa till relevanta lagrum (ange lagrumstextens rubrik eller nummer).
`;

    logWithContext("info", "Asking GPT for answer", requestContext);

    // 4) Ask LLM
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Du är en noggrann juridisk assistent.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      logWithContext("error", "OpenAI completion error", { ...requestContext, status: completionResponse.status, response: errorText });
      
      if (completionResponse.status === 429) {
        return createErrorResponse("RATE_LIMIT", "För många förfrågningar. Försök igen senare.", 429);
      }
      
      return createErrorResponse("AI_ERROR", "Kunde inte få svar från AI", 500);
    }

    const completionData = await completionResponse.json();
    const answer = completionData.choices[0].message?.content || 'Inget svar kunde genereras.';

    logWithContext("info", "Successfully generated answer", requestContext);

    return new Response(
      JSON.stringify({
        answer,
        matches: matches.map((m: any) => ({
          id: m.id,
          title: m.title,
          lagrum: m.lagrum,
          similarity: m.similarity,
          regelverk_name: m.regelverk_name,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logWithContext("error", "Unhandled error in ask-legal-question", {
      ...requestContext,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return createErrorResponse(
      "SERVER_ERROR",
      error instanceof Error ? error.message : "Serverfel",
      500
    );
  }
});
