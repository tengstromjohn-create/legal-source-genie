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

// Förbättrad segmentering för svenska lagar från PDF
function segmentLawText(fullText: string, regelverkName: string): LawBlock[] {
  // Normalize whitespace - PDF extraction often has extra spaces
  const normalizedText = fullText
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\s+\n/g, '\n')  // Clean up line breaks
    .trim();

  const blocks: LawBlock[] = [];
  
  // Match patterns like "1 kap. 2 §" or "2 §" or "1 kap."
  // This regex finds chapter and section markers
  const lagrumPattern = /(\d+\s*kap\.\s*\d+\s*§|\d+\s*kap\.|\d+\s*§)/gi;
  
  const matches = Array.from(normalizedText.matchAll(lagrumPattern));
  
  if (matches.length === 0) {
    console.log('No lagrum patterns found in text');
    return [];
  }
  
  console.log(`Found ${matches.length} potential lagrum markers`);
  
  let currentChapter = '';
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatch = matches[i + 1];
    
    const lagrumText = match[0].trim();
    const startIndex = match.index!;
    const endIndex = nextMatch ? nextMatch.index! : normalizedText.length;
    
    // Extract the text for this lagrum
    let text = normalizedText.substring(startIndex, endIndex).trim();
    
    // Build the full lagrum reference
    let fullLagrum = lagrumText;
    
    // If it's just a chapter marker (e.g., "1 kap."), update current chapter
    if (lagrumText.match(/^\d+\s*kap\.$/i)) {
      currentChapter = lagrumText.replace(/\s+/g, ' ').trim();
      
      // Only create a block if there's substantial text
      if (text.length > 100) {
        fullLagrum = `${regelverkName} ${currentChapter}`;
        blocks.push({ lagrum: fullLagrum, text });
      }
    }
    // If it's a section without chapter (e.g., "4 §"), combine with current chapter
    else if (lagrumText.match(/^\d+\s*§$/i) && currentChapter) {
      fullLagrum = `${currentChapter} ${lagrumText.replace(/\s+/g, ' ').trim()}`;
      
      if (text.length > 50) {
        fullLagrum = `${regelverkName} ${fullLagrum}`;
        blocks.push({ lagrum: fullLagrum, text });
      }
    }
    // If it's a full reference (e.g., "1 kap. 2 §")
    else if (lagrumText.match(/^\d+\s*kap\.\s*\d+\s*§$/i)) {
      // Update current chapter from this reference
      const chapterMatch = lagrumText.match(/(\d+\s*kap\.)/i);
      if (chapterMatch) {
        currentChapter = chapterMatch[1].replace(/\s+/g, ' ').trim();
      }
      
      if (text.length > 50) {
        fullLagrum = `${regelverkName} ${lagrumText.replace(/\s+/g, ' ').trim()}`;
        blocks.push({ lagrum: fullLagrum, text });
      }
    }
  }
  
  console.log(`Created ${blocks.length} valid blocks`);
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
    
    // Limit to 50 pages to avoid CPU timeout
    const maxPages = Math.min(numPages, 50);
    if (numPages > 50) {
      console.log(`WARNING: Document has ${numPages} pages, limiting to first ${maxPages} pages`);
    }
    
    let fullText = '';
    for (let i = 1; i <= maxPages; i++) {
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
    
    // Log first 500 chars to see the structure
    console.log('First 500 chars:', fullText.substring(0, 500));

    // Segment the text into legal blocks
    const blocks = segmentLawText(fullText, regelverkName);
    console.log(`Segmented into ${blocks.length} legal blocks`);

    if (blocks.length === 0) {
      console.log('No segments found, saving entire document as one block');
      // If no segments found, save the whole text as one source
      const { error: insertError } = await supabase
        .from('legal_source')
        .insert({
          regelverk_name: regelverkName,
          typ,
          referens,
          title: regelverkName,
          content: fullText.substring(0, 500),
          full_text: fullText,
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save document', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Successfully saved entire document');
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Document saved successfully',
          pages: numPages,
          processedPages: maxPages,
          inserted: 1
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert in batches
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
        console.error(`Batch insert error:`, insertError);
      } else {
        totalInserted += rowsToInsert.length;
        console.log(`Inserted: ${totalInserted}/${blocks.length}`);
      }
    }

    console.log(`Completed: ${totalInserted} sources saved`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Document processed successfully',
        pages: numPages,
        processedPages: maxPages,
        inserted: totalInserted
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