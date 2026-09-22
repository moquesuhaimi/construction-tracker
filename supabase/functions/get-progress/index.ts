// Supabase Edge Function: proxies the Progress Manager app's /api/progress
// endpoint so the PROGRESS_API_KEY never has to be shipped to the browser.
// The frontend calls this function (via supabase.functions.invoke), and
// this function is the only place that holds the real key.

const PROGRESS_API_URL = 'https://progress.builderscartel.com/api/progress';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('PROGRESS_API_KEY');

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'PROGRESS_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(PROGRESS_API_URL, {
      headers: { 'x-api-key': apiKey },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Progress API returned ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to fetch progress' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
