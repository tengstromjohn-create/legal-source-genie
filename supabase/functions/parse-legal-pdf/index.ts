import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
import { getDocument } from 'https://esm.sh/pdfjs-serverless@0.3.2';

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

    // Parse PDF to extract text
    const arrayBuffer = await file.arrayBuffer();
    const pdfData = new Uint8Array(arrayBuffer);
    
    console.log('Parsing PDF with pdfjs-serverless...');
    const doc = await getDocument(pdfData).promise;
    const numPages = doc.numPages;
    
    console.log(`PDF has ${numPages} pages`);
    
    let fullText = '';
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    if (!fullText || fullText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No text extracted from PDF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Insert in batches to avoid CPU timeout
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < blocks.length; i += batchSize) {
      const batch = blocks.slice(i, i + batchSize);
      const rowsToInsert = batch.map((block) => ({
        regelverk_name: regelverkName,
        typ,
        lagrum: block.lagrum,
        referens,
        title: block.lagrum,
        content: block.text.substring(0, 500),
        full_text: block.text,
      }));

      const { error: insertError } = await supabase
        .from('legal_source')
        .insert(rowsToInsert);

      if (insertError) {
        console.error(`Batch ${i}-${i+batch.length} insert error:`, insertError);
      } else {
        totalInserted += rowsToInsert.length;
        console.log(`Inserted batch: ${totalInserted}/${blocks.length}`);
      }
    }

    console.log(`Successfully inserted ${totalInserted} legal sources`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalInserted,
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