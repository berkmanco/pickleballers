// Supabase Edge Function: send-sms
// Uses Twilio API to send SMS messages

// Deno runtime type declaration (for IDE support)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore - Deno URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

interface SmsRequest {
  to: string;
  message: string;
}

interface TwilioResponse {
  sid?: string;
  error_code?: number;
  error_message?: string;
}

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio credentials are not configured");
    }

    const { to, message }: SmsRequest = await req.json();

    // Validate required fields
    if (!to || !message) {
      throw new Error("Missing required fields: to, message");
    }

    // Format phone number (ensure E.164 format)
    const formattedPhone = formatPhoneNumber(to);
    if (!formattedPhone) {
      throw new Error("Invalid phone number format");
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: TWILIO_PHONE_NUMBER,
        Body: message,
      }),
    });

    const data: TwilioResponse = await response.json();

    if (!response.ok || data.error_code) {
      console.error("Twilio API error:", data);
      throw new Error(data.error_message || "Failed to send SMS");
    }

    console.log("SMS sent successfully:", data.sid);

    return new Response(
      JSON.stringify({ success: true, sid: data.sid }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

// Format phone number to E.164 format (US numbers)
function formatPhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // US number: 10 digits or 11 starting with 1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  // Already in E.164 format
  if (phone.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }
  
  return null;
}
