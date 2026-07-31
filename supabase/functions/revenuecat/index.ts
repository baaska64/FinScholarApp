import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

console.log("RevenueCat webhook function started!")

serve(async (req) => {
  try {
    const payload = await req.json();
    const event = payload.event;
    
    if (!event || !event.app_user_id) {
      return new Response("Missing event data", { status: 400 });
    }

    const userId = event.app_user_id;
    const eventType = event.type;

    // Determine premium status based on the event
    let isPremium = false;
    
    if (["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"].includes(eventType)) {
      isPremium = true;
    } else if (["EXPIRATION", "BILLING_ISSUE"].includes(eventType)) {
      isPremium = false;
    } else {
      // Ignore other events (like test events, cancellation still keeps it active until expiration)
      return new Response("Ignored event type", { status: 200 });
    }

    // Initialize Supabase client with the Service Role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update the profile securely
    const { error } = await supabase
      .from('profiles')
      .update({ is_premium: isPremium })
      .eq('id', userId);

    if (error) {
      console.error("Error updating profile:", error);
      return new Response("Database error", { status: 500 });
    }

    console.log(`Successfully updated user ${userId} to premium: ${isPremium}`);
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
})
