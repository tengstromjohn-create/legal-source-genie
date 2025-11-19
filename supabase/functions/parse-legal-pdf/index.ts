import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LawBlock = {
  lagrum: string;
  text: string;
};

// Förenklad segmentering för svenska lagar.
// Du kan tweaka regexarna vid behov.
function segmentLawText(fullText: string, regelverkName: string): LawBlock[] {
  const lines = fullText.split("\n").map((l) => l.trim());
  const blocks: LawBlock[] = [];

  let currentChapter: string | null = null;   // t.ex. "8 kap."
  let currentLagrum: string | null = null;    // t.ex. "8 kap. 4 §"
  let currentLines: string[] = [];

  // Kapitel-rader: "8 kap." eller "8 kap. Bolagets ledning"
  const chapterRegex = /^(\d+\s*kap\.)/i;

  // Paragrafrader:
  // - antingen "8 kap. 4 §"
  // - eller "4 §" (vi fyller på kapitel från currentChapter)
  const fullLagrumRegex = /^(\d+\s*kap\.\s*\d+\s*§)/i;
  const paragrafOnlyRegex = /^(\d+\s*§)/;

  const flushBlock = () => {
    if (currentLagrum && currentLines.length > 0) {
      blocks.push({
        lagrum: currentLagrum,
        text: currentLines.join("\n").trim(),
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    if (!line) continue;

    // 1) Först – kolla om det är en kapitelrad
    const chapterMatch = line.match(chapterRegex);
    if (chapterMatch) {
      currentChapter = chapterMatch[1].trim(); // t.ex. "8 kap."
      continue; // vi fortsätter, kapitel i sig är oftast inte ett eget lagrum
    }

    // 2) Kolla om det är ett "fullt" lagrum: "8 kap. 4 §"
    const fullLagrumMatch = line.match(fullLagrumRegex);
    if (fullLagrumMatch) {
      // spara föregående block
      flushBlock();
      currentLagrum = fullLagrumMatch[1].trim();
      // ta bort lagrumsdelen från raden, resten är ev. rubrik/ingress
      const rest = line.replace(fullLagrumRegex, "").trim();
      if (rest) currentLines.push(rest);
      continue;
    }

    // 3) Kolla om det är en paragraf "4 §" och vi har ett currentChapter
    const paragrafMatch = line.match(paragrafOnlyRegex);
    if (paragrafMatch && currentChapter) {
      flushBlock();
      const paragraf = paragrafMatch[1].trim(); // "4 §"
      currentLagrum = `${currentChapter} ${paragraf}`; // "8 kap. 4 §"
      const rest = line.replace(paragrafOnlyRegex, "").trim();
      if (rest) currentLines.push(rest);
      continue;
    }

    // 4) Vanlig rad – hör till nuvarande lagrum
    if (currentLagrum) {
      currentLines.push(line);
    }
  }

  // sista blocket
  flushBlock();

  return blocks;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const regelverkName = formData.get('regelverk_name') as string;
    const typ = formData.get('typ') as string || 'lag';
    const referens = formData.get('referens') as string || null;

    if (!file || !regelverkName) {
      return new Response(
        JSON.stringify({ error: 'file and regelverk_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing PDF: ${file.name} for ${regelverkName}`);

    // Convert file to base64 for AI parsing
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid call stack overflow
    let base64 = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      base64 += String.fromCharCode(...chunk);
    }
    base64 = btoa(base64);

    // Use Lovable AI to parse the PDF
    console.log('Calling Lovable AI to parse PDF...');
    const aiResponse = await fetch('https://api.lovable.app/ai/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract all text from this Swedish legal document. Return ONLY the raw text content, no explanations or formatting.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 16000
      })
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI parsing failed:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to parse PDF with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await aiResponse.json();
    const fullText = aiResult.choices[0].message.content;

    console.log(`Extracted ${fullText.length} characters from PDF`);

    // Segment the text into legal blocks
    const blocks = segmentLawText(fullText, regelverkName);

    if (blocks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not find any legal sections in the document' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Segmented into ${blocks.length} legal blocks`);

    // Insert into legal_source table
    const rowsToInsert = blocks.map((block) => ({
      regelverk_name: regelverkName,
      typ,
      lagrum: block.lagrum,
      referens,
      title: block.lagrum,
      content: block.text.substring(0, 500), // Short preview
      full_text: block.text,
    }));

    const { error: insertError, data } = await supabase
      .from('legal_source')
      .insert(rowsToInsert)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save legal sources', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully inserted ${rowsToInsert.length} legal sources`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: rowsToInsert.length,
        sources: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});