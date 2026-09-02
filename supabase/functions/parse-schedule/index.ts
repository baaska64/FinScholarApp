import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { base64Data, customInstructions } = await req.json();
    if (!base64Data) throw new Error("Missing base64Data");

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in the Edge Function secrets.");

    // Extract mime type and raw base64 string
    const match = base64Data.match(/^data:(image\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
    if (!match) throw new Error("Invalid image format. Expected data:image/...;base64,...");
    const mimeType = match[1];
    const rawBase64 = match[2];

    const prompt = `You are a schedule parser for a student planner. You will be given an
image of ONE of these, and you must handle either:

  A) A VISUAL TIMETABLE — a weekly grid, where each block sits under a day
     column and spans its time rows.
  B) A STUDY LOAD / ENROLLMENT FORM — a table of enrolled subjects, one row per
     subject, with the days written as a code and the time as a printed range.

Work out which one you are looking at, then output one object per SUBJECT ROW
(for a study load) or per DISTINCT BLOCK (for a timetable).

TRANSCRIBE — DO NOT CALCULATE. Copy what is printed, exactly as printed. The
app converts days and times itself, and its conversion is more reliable than
arithmetic done here.

  - "day": copy the day text verbatim — "MWF", "TTh", "M-F", "Tuesday",
    "Mon/Wed", "MTWThF". Do NOT split a multi-day code into separate objects,
    and do NOT convert it to a number. One row with "MWF" is ONE object whose
    day is "MWF".
  - "startTime" / "endTime": copy the printed clock times — "8:00 AM",
    "1:30 PM", "13:30". Do NOT convert to 24-hour decimals. If only a start is
    shown, leave endTime empty.
  - "name": the subject or course code as printed (e.g. "CSIT227", "IT227 G4").
  - "room": the room or venue if shown, else empty. "instructor": if shown,
    else empty.

Rules:
1. Include EVERY subject or block that appears. Do not summarise or merge.
2. If one subject has two different meeting patterns (e.g. a lecture on MWF and
   a lab on Saturday), output one object per pattern.
3. If a field is not shown, use an empty string — never invent a value.
4. Ignore totals, unit counts, tuition, student details and any other
   non-schedule content.
${customInstructions ? `
Additional user instructions (follow these too):
${customInstructions}` : ""}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: rawBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          // The model now only transcribes; day expansion and time arithmetic
          // happen in utils/scheduleParsing.ts, which is deterministic and
          // covered by tests. That removes the one part of this job that
          // needed reasoning, so the thinking pass is pure latency.
          // Drop this field entirely if the model behind `-latest` rejects it.
          thinkingConfig: { thinkingBudget: 0 },
          // The same timetable should parse the same way every time.
          temperature: 0,
          maxOutputTokens: 8192,
          // Guarantees a valid JSON array: no prose to strip, no repair step,
          // and fewer output tokens than "here is your schedule: [...]".
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                // Verbatim day text — "MWF", "TTh", "Mon-Fri", "Tuesday".
                // utils/scheduleParsing.ts expands this into ledger day indices.
                day: { type: "STRING" },
                // Verbatim clock times — "8:00 AM", "13:30".
                startTime: { type: "STRING" },
                endTime: { type: "STRING" },
                room: { type: "STRING" },
                instructor: { type: "STRING" }
              },
              required: ["name", "day", "startTime"]
            }
          }
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      throw new Error(data.error?.message || JSON.stringify(data));
    }

    if (!data.candidates || !data.candidates[0]?.content?.parts || !data.candidates[0].content.parts[0]) {
      console.error("Gemini Unexpected Response:", data);
      throw new Error("Unexpected response from Gemini API: " + JSON.stringify(data));
    }

    let ocrText = data.candidates[0].content.parts[0].text || "";
    console.log("AI raw output:", ocrText);

    // Robustly extract JSON array from potential conversational text
    const jsonMatch = ocrText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      ocrText = jsonMatch[0];
    } else {
      console.error("No JSON array brackets found in output");
    }
    
    ocrText = ocrText.trim();

    let parsed = [];
    try {
      parsed = JSON.parse(ocrText);
    } catch (e) {
      console.error("Failed to parse JSON from AI", e);
      throw new Error("AI returned invalid JSON format.");
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Could not extract any schedule entries from the image.");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Edge function error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
