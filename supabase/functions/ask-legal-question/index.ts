import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: "Fråga (question) saknas" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Generating embedding for question:', question);

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
      console.error('OpenAI embedding error:', errorText);
      throw new Error('Failed to generate embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('Searching for relevant legal sources...');

    // 2) Find relevant legal texts using RPC function
    const { data: matches, error } = await supabase.rpc('match_legal_sources', {
      query_embedding: queryEmbedding,
      match_count: 5,
      match_threshold: 0.5,
    });

    if (error) {
      console.error('Database search error:', error);
      throw new Error('Sökfel i databasen');
    }

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({
          answer: 'Inga relevanta lagrum hittades för din fråga. Försök omformulera frågan eller kontrollera att lagtexter har laddats upp och fått embeddings.',
          matches: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${matches.length} relevant sources`);

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

    console.log('Asking GPT for answer...');

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
      console.error('OpenAI completion error:', errorText);
      throw new Error('Failed to get answer from AI');
    }

    const completionData = await completionResponse.json();
    const answer = completionData.choices[0].message?.content || 'Inget svar kunde genereras.';

    console.log('Successfully generated answer');

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
    console.error('Error in ask-legal-question:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Serverfel',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
