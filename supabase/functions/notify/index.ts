// Supabase Edge Function: notify
// Orchestrates sending notifications (email/SMS) based on notification type

// Deno runtime type declaration (for IDE support)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore - Deno URL imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno URL imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "DinkUp <noreply@dinkup.link>";
const APP_URL = Deno.env.get("APP_URL") || "https://www.dinkup.link";

// Test mode: skip actual email/SMS in local development
// Check for local Supabase URL patterns (various forms used in dev)
const IS_LOCAL = SUPABASE_URL?.includes("127.0.0.1") || 
                 SUPABASE_URL?.includes("localhost") ||
                 SUPABASE_URL?.includes("kong:8000") ||
                 SUPABASE_URL?.includes("supabase_kong");
const TEST_MODE = Deno.env.get("TEST_MODE") === "true" || IS_LOCAL;

// Log for debugging (will show in edge function logs)
console.log(`[notify] SUPABASE_URL: ${SUPABASE_URL}, IS_LOCAL: ${IS_LOCAL}, TEST_MODE: ${TEST_MODE}`);

// Notification types
type NotificationType = 
  | "session_created"      // New session proposed in a pool
  | "roster_locked"        // Roster locked, payment due
  | "payment_reminder"     // Follow-up payment reminder
  | "session_reminder"     // 24h before session
  | "waitlist_promoted";   // Player promoted from waitlist

interface NotifyRequest {
  type: NotificationType;
  sessionId?: string;
  playerId?: string;       // For single-player notifications
  playerIds?: string[];    // For batch notifications
  customMessage?: string;  // Optional override message
}

interface Player {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notification_preferences: {
    email: boolean;
    sms: boolean;
  };
}

interface Session {
  id: string;
  proposed_date: string;
  proposed_time: string;
  court_location?: string;
  pool: {
    id: string;
    name: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  venmo_payment_link: string;
  session_participant: {
    player: Player;
  };
}

// Extract first name from full name
function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { type, sessionId, playerId, playerIds, customMessage }: NotifyRequest = await req.json();

    if (!type) {
      throw new Error("Missing required field: type");
    }

    let results: { sent: number; failed: number; errors: string[] } = { sent: 0, failed: 0, errors: [] };

    switch (type) {
      case "session_created":
        if (!sessionId) throw new Error("sessionId required for session_created");
        results = await notifySessionCreated(supabase, sessionId);
        break;

      case "roster_locked":
        if (!sessionId) throw new Error("sessionId required for roster_locked");
        results = await notifyRosterLocked(supabase, sessionId);
        break;

      case "payment_reminder":
        if (!sessionId) throw new Error("sessionId required for payment_reminder");
        results = await notifyPaymentReminder(supabase, sessionId, customMessage);
        break;

      case "session_reminder":
        if (!sessionId) throw new Error("sessionId required for session_reminder");
        results = await notifySessionReminder(supabase, sessionId);
        break;

      case "waitlist_promoted":
        if (!sessionId || !playerId) throw new Error("sessionId and playerId required for waitlist_promoted");
        results = await notifyWaitlistPromoted(supabase, sessionId, playerId);
        break;

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Notification error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

// ============================================
// NOTIFICATION HANDLERS
// ============================================

async function notifySessionCreated(supabase: ReturnType<typeof createClient>, sessionId: string) {
  // Get session details with pool
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, pool:pools(id, name)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Get all pool members (excluding the admin who created it)
  const { data: poolPlayers, error: playersError } = await supabase
    .from("pool_players")
    .select("player:players(id, name, email, phone, notification_preferences)")
    .eq("pool_id", session.pool.id)
    .eq("is_active", true);

  if (playersError) throw playersError;

  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const sessionDate = formatDate(session.proposed_date);
  const sessionTime = formatTime(session.proposed_time);

  for (const pp of poolPlayers || []) {
    const player = pp.player as Player;
    if (!player.email || !player.notification_preferences?.email) continue;

    const html = emailTemplate({
      title: "New Session Proposed! 🏓",
      preheader: `${session.pool.name} - ${sessionDate}`,
      body: `
        <p>Hey ${getFirstName(player.name)}!</p>
        <p>A new pickleball session has been proposed for <strong>${session.pool.name}</strong>:</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>📅 Date:</strong> ${sessionDate}</p>
          <p style="margin: 8px 0 0 0;"><strong>⏰ Time:</strong> ${sessionTime}</p>
        </div>
        <p>Are you in? Click below to opt in!</p>
      `,
      ctaText: "View Session",
      ctaUrl: `${APP_URL}/sessions/${sessionId}`,
    });

    try {
      await sendEmail(player.email, `New Session: ${session.pool.name} - ${sessionDate}`, html);
      results.sent++;
      await logNotification(supabase, "session_created", sessionId, player.id, "email", true);
    } catch (err) {
      results.failed++;
      results.errors.push(`${player.email}: ${(err as Error).message}`);
      await logNotification(supabase, "session_created", sessionId, player.id, "email", false, (err as Error).message);
    }
  }

  return results;
}

async function notifyRosterLocked(supabase: ReturnType<typeof createClient>, sessionId: string) {
  // Get session with pool info
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, pool:pools(id, name)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Get pending payments with player info
  // Note: Must use !inner to filter on nested relation
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(`
      id, amount, venmo_payment_link,
      session_participant:session_participants!inner(
        session_id,
        player:players(id, name, email, phone, notification_preferences)
      )
    `)
    .eq("session_participant.session_id", sessionId)
    .eq("status", "pending");

  if (paymentsError) throw paymentsError;

  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const sessionDate = formatDate(session.proposed_date);
  const sessionTime = formatTime(session.proposed_time);

  for (const payment of payments || []) {
    const player = (payment.session_participant as { player: Player })?.player;
    if (!player?.email || !player.notification_preferences?.email) continue;

    const html = emailTemplate({
      title: "Roster Locked - Payment Due 💰",
      preheader: `$${payment.amount.toFixed(2)} due for ${session.pool.name}`,
      body: `
        <p>Hey ${getFirstName(player.name)}!</p>
        <p>The roster has been locked for <strong>${session.pool.name}</strong>. You're committed!</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>📅 Date:</strong> ${sessionDate}</p>
          <p style="margin: 8px 0 0 0;"><strong>⏰ Time:</strong> ${sessionTime}</p>
          <p style="margin: 8px 0 0 0;"><strong>💵 Amount Due:</strong> $${payment.amount.toFixed(2)}</p>
        </div>
        <p>Please pay via Venmo before the session:</p>
      `,
      ctaText: "Pay with Venmo",
      ctaUrl: payment.venmo_payment_link,
      secondaryCtaText: "View Session",
      secondaryCtaUrl: `${APP_URL}/sessions/${sessionId}`,
    });

    try {
      await sendEmail(player.email, `Payment Due: $${payment.amount.toFixed(2)} for ${session.pool.name}`, html);
      results.sent++;
      await logNotification(supabase, "roster_locked", sessionId, player.id, "email", true);
    } catch (err) {
      results.failed++;
      results.errors.push(`${player.email}: ${(err as Error).message}`);
      await logNotification(supabase, "roster_locked", sessionId, player.id, "email", false, (err as Error).message);
    }
  }

  return results;
}

async function notifyPaymentReminder(supabase: ReturnType<typeof createClient>, sessionId: string, customMessage?: string) {
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, pool:pools(id, name)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Only get PENDING payments
  // Note: Must use !inner to filter on nested relation
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(`
      id, amount, venmo_payment_link,
      session_participant:session_participants!inner(
        session_id,
        player:players(id, name, email, phone, notification_preferences)
      )
    `)
    .eq("session_participant.session_id", sessionId)
    .eq("status", "pending");

  if (paymentsError) throw paymentsError;

  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const sessionDate = formatDate(session.proposed_date);

  for (const payment of payments || []) {
    const player = (payment.session_participant as { player: Player })?.player;
    if (!player?.email || !player.notification_preferences?.email) continue;

    const html = emailTemplate({
      title: "Payment Reminder ⏰",
      preheader: `$${payment.amount.toFixed(2)} still due for ${session.pool.name}`,
      body: `
        <p>Hey ${getFirstName(player.name)}!</p>
        <p>Friendly reminder - you still owe <strong>$${payment.amount.toFixed(2)}</strong> for the ${session.pool.name} session on ${sessionDate}.</p>
        ${customMessage ? `<p style="font-style: italic;">"${customMessage}"</p>` : ""}
        <p>Please pay via Venmo at your earliest convenience:</p>
      `,
      ctaText: "Pay with Venmo",
      ctaUrl: payment.venmo_payment_link,
    });

    try {
      await sendEmail(player.email, `Reminder: $${payment.amount.toFixed(2)} due for ${session.pool.name}`, html);
      results.sent++;
      await logNotification(supabase, "payment_reminder", sessionId, player.id, "email", true);
    } catch (err) {
      results.failed++;
      results.errors.push(`${player.email}: ${(err as Error).message}`);
      await logNotification(supabase, "payment_reminder", sessionId, player.id, "email", false, (err as Error).message);
    }
  }

  return results;
}

async function notifySessionReminder(supabase: ReturnType<typeof createClient>, sessionId: string) {
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, court_location, pool:pools(id, name)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Get all committed participants
  const { data: participants, error: participantsError } = await supabase
    .from("session_participants")
    .select("player:players(id, name, email, phone, notification_preferences)")
    .eq("session_id", sessionId)
    .eq("status", "committed");

  if (participantsError) throw participantsError;

  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const sessionDate = formatDate(session.proposed_date);
  const sessionTime = formatTime(session.proposed_time);
  
  // Determine if session is today or tomorrow
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDateObj = new Date(session.proposed_date + "T00:00:00");
  const diffDays = Math.round((sessionDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isToday = diffDays === 0;
  const isTomorrow = diffDays === 1;
  
  const timeWord = isToday ? "today" : isTomorrow ? "tomorrow" : `on ${sessionDate}`;
  const title = isToday ? "Game Day! 🏓" : isTomorrow ? "See You Tomorrow! 🏓" : "Session Reminder 🏓";

  for (const participant of participants || []) {
    const player = participant.player as Player;
    
    // Send email if enabled
    if (player.email && player.notification_preferences?.email) {
      const html = emailTemplate({
        title,
        preheader: `${session.pool.name} session ${timeWord} at ${sessionTime}`,
        body: `
          <p>Hey ${getFirstName(player.name)}!</p>
          <p>Just a reminder - you're playing ${timeWord}!</p>
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>🏓 Pool:</strong> ${session.pool.name}</p>
            <p style="margin: 8px 0 0 0;"><strong>📅 Date:</strong> ${sessionDate}</p>
            <p style="margin: 8px 0 0 0;"><strong>⏰ Time:</strong> ${sessionTime}</p>
            ${session.court_location ? `<p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${session.court_location}</p>` : ""}
          </div>
          <p>See you on the court!</p>
        `,
        ctaText: "View Session",
        ctaUrl: `${APP_URL}/sessions/${sessionId}`,
      });

      try {
        const subjectPrefix = isToday ? "Today" : isTomorrow ? "Tomorrow" : sessionDate;
        await sendEmail(player.email, `${subjectPrefix}: ${session.pool.name} at ${sessionTime}`, html);
        results.sent++;
        await logNotification(supabase, "session_reminder", sessionId, player.id, "email", true);
      } catch (err) {
        results.failed++;
        results.errors.push(`${player.email}: ${(err as Error).message}`);
      }
    }

    // Send SMS if enabled and phone exists
    if (player.phone && player.notification_preferences?.sms) {
      const smsMessage = `🏓 DinkUp Reminder: ${session.pool.name} ${timeWord} at ${sessionTime}. See you on the court!`;
      
      try {
        await sendSms(player.phone, smsMessage);
        results.sent++;
        await logNotification(supabase, "session_reminder", sessionId, player.id, "sms", true);
      } catch (err) {
        results.failed++;
        results.errors.push(`SMS ${player.phone}: ${(err as Error).message}`);
      }
    }
  }

  return results;
}

async function notifyWaitlistPromoted(supabase: ReturnType<typeof createClient>, sessionId: string, playerId: string) {
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, pool:pools(id, name)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, name, email, phone, notification_preferences")
    .eq("id", playerId)
    .single();

  if (playerError || !player) throw new Error("Player not found");

  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const sessionDate = formatDate(session.proposed_date);
  const sessionTime = formatTime(session.proposed_time);

  // Send email
  if (player.email && player.notification_preferences?.email) {
    const html = emailTemplate({
      title: "You're In! 🎉",
      preheader: `Promoted from waitlist for ${session.pool.name}`,
      body: `
        <p>Great news, ${getFirstName(player.name)}!</p>
        <p>A spot opened up and you've been promoted from the waitlist for <strong>${session.pool.name}</strong>!</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>📅 Date:</strong> ${sessionDate}</p>
          <p style="margin: 8px 0 0 0;"><strong>⏰ Time:</strong> ${sessionTime}</p>
        </div>
        <p>You're now committed to this session. If you can no longer make it, please drop out as soon as possible so someone else can take your spot.</p>
      `,
      ctaText: "View Session",
      ctaUrl: `${APP_URL}/sessions/${sessionId}`,
    });

    try {
      await sendEmail(player.email, `You're In! ${session.pool.name} on ${sessionDate}`, html);
      results.sent++;
      await logNotification(supabase, "waitlist_promoted", sessionId, player.id, "email", true);
    } catch (err) {
      results.failed++;
      results.errors.push(`${player.email}: ${(err as Error).message}`);
    }
  }

  // Send SMS for time-sensitive notification
  if (player.phone && player.notification_preferences?.sms) {
    const smsMessage = `🎉 DinkUp: You're in! Promoted from waitlist for ${session.pool.name} on ${sessionDate} at ${sessionTime}. View: ${APP_URL}/sessions/${sessionId}`;
    
    try {
      await sendSms(player.phone, smsMessage);
      results.sent++;
      await logNotification(supabase, "waitlist_promoted", sessionId, player.id, "sms", true);
    } catch (err) {
      results.failed++;
      results.errors.push(`SMS ${player.phone}: ${(err as Error).message}`);
    }
  }

  return results;
}

// ============================================
// HELPERS
// ============================================

// Rate limit delay for Resend free tier (max 2 emails/second)
const RATE_LIMIT_DELAY_MS = 600; // 600ms between emails = ~1.6 emails/sec (safe margin)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEmail(to: string, subject: string, html: string) {
  // In test mode, skip actual email sending
  if (TEST_MODE) {
    console.log(`[TEST MODE] Would send email to: ${to}`);
    console.log(`[TEST MODE] Subject: ${subject}`);
    return { id: `test-${Date.now()}`, message: "Test mode - email not sent" };
  }

  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send email");
  }

  // Rate limit: wait before allowing next email
  await sleep(RATE_LIMIT_DELAY_MS);

  return response.json();
}

async function sendSms(to: string, message: string) {
  // In test mode, skip actual SMS sending
  if (TEST_MODE) {
    console.log(`[TEST MODE] Would send SMS to: ${to}`);
    console.log(`[TEST MODE] Message: ${message}`);
    return { sid: `test-${Date.now()}`, message: "Test mode - SMS not sent" };
  }

  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  // Support both secret names for backwards compatibility
  const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error("Twilio credentials not configured");
  }

  const formattedPhone = formatPhoneNumber(to);
  if (!formattedPhone) {
    throw new Error("Invalid phone number");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: TWILIO_FROM_NUMBER,
        Body: message,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send SMS");
  }

  return response.json();
}

async function logNotification(
  supabase: ReturnType<typeof createClient>,
  type: NotificationType,
  sessionId: string,
  playerId: string,
  channel: "email" | "sms",
  success: boolean,
  errorMessage?: string
) {
  await supabase.from("notifications_log").insert({
    type,
    session_id: sessionId,
    player_id: playerId,
    channel,
    success,
    error_message: errorMessage,
  });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPhoneNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

interface EmailTemplateParams {
  title: string;
  preheader: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
}

function emailTemplate(params: EmailTemplateParams): string {
  const { title, preheader, body, ctaText, ctaUrl, secondaryCtaText, secondaryCtaUrl } = params;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preheader text (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #10b981;">🏓 DinkUp</h1>
            </td>
          </tr>
          
          <!-- Title -->
          <tr>
            <td style="padding: 24px 32px 0; text-align: center;">
              <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">${title}</h2>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 24px 32px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
              ${body}
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 32px 24px; text-align: center;">
              <a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">${ctaText}</a>
            </td>
          </tr>
          
          ${secondaryCtaText && secondaryCtaUrl ? `
          <!-- Secondary CTA -->
          <tr>
            <td style="padding: 0 32px 32px; text-align: center;">
              <a href="${secondaryCtaUrl}" style="color: #10b981; text-decoration: none; font-size: 14px;">${secondaryCtaText}</a>
            </td>
          </tr>
          ` : ""}
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                You're receiving this email because you're a member of a DinkUp pool.<br>
                <a href="${APP_URL}/settings" style="color: #a1a1aa;">Manage notification preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
