import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LegalBlock {
  lagrum: string;
  text: string;
}

// Segment legal text into blocks based on Swedish legal numbering (e.g., "1 §", "2 kap.", etc.)
function segmentLawText(fullText: string, regelverkName: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  
  // Split by paragraph markers (§) or chapter markers (kap.)
  const paragraphPattern = /(\d+\s*§|\d+\s*kap\.|\d+\s*a\s*§)/gi;
  const matches = Array.from(fullText.matchAll(paragraphPattern));
  
  if (matches.length === 0) {
    // If no standard markers found, split by double newlines or numbered sections
    const sections = fullText.split(/\n\n+/).filter(s => s.trim().length > 50);
    sections.forEach((text, idx) => {
      blocks.push({
        lagrum: `${regelverkName} § ${idx + 1}`,
        text: text.trim()
      });
    });
    return blocks;
  }
  
  // Extract text between markers
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];
    
    const startIndex = currentMatch.index!;
    const endIndex = nextMatch ? nextMatch.index! : fullText.length;
    
    const text = fullText.substring(startIndex, endIndex).trim();
    const lagrum = `${regelverkName} ${currentMatch[0].trim()}`;
    
    if (text.length > 20) { // Only include substantial sections
      blocks.push({ lagrum, text });
    }
  }
  
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
    const base64 = btoa(String.fromCharCode(...bytes));

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