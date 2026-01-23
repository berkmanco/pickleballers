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

// SMS disabled until Twilio number is approved
// TODO: Set to false once toll-free verification is complete
const SMS_DISABLED = true;

// Log for debugging (will show in edge function logs)
console.log(`[notify] SUPABASE_URL: ${SUPABASE_URL}, IS_LOCAL: ${IS_LOCAL}, TEST_MODE: ${TEST_MODE}`);

// Notification types
type NotificationType = 
  | "session_created"      // New session proposed in a pool
  | "roster_locked"        // Roster locked, payment due
  | "payment_reminder"     // Follow-up payment reminder
  | "session_reminder"     // 24h before session
  | "waitlist_promoted"    // Player promoted from waitlist
  | "commitment_reminder"  // Remind uncommitted players to opt in
  | "admin_low_commitment" // Alert admin when not enough players committed
  | "session_cancelled";   // Session has been cancelled

interface NotifyRequest {
  type: NotificationType;
  sessionId?: string;
  playerId?: string;       // For single-player notifications
  playerIds?: string[];    // For batch notifications
  customMessage?: string;  // Optional override message
  testEmail?: string;      // For testing: only send to this email address
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
  court_numbers?: string[];
  pool: {
    id: string;
    name: string;
    owner_id?: string;
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

// Generate Google Calendar URL
function generateGoogleCalendarUrl(
  title: string,
  location: string,
  date: string,
  time: string,
  durationMinutes: number,
  sessionUrl: string
): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  
  const startDt = new Date(year, month - 1, day, hours, minutes);
  const endDt = new Date(startDt.getTime() + durationMinutes * 60 * 1000);
  
  const formatDate = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatDate(startDt)}/${formatDate(endDt)}`,
    details: `Pickleball session.\n\nView details: ${sessionUrl}`,
    location: location,
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
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
    const { type, sessionId, playerId, playerIds, customMessage, testEmail }: NotifyRequest = await req.json();

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
        results = await notifySessionReminder(supabase, sessionId, testEmail);
        break;

      case "waitlist_promoted":
        if (!sessionId || !playerId) throw new Error("sessionId and playerId required for waitlist_promoted");
        results = await notifyWaitlistPromoted(supabase, sessionId, playerId);
        break;

      case "commitment_reminder":
        if (!sessionId) throw new Error("sessionId required for commitment_reminder");
        results = await notifyCommitmentReminder(supabase, sessionId);
        break;

      case "admin_low_commitment":
        if (!sessionId) throw new Error("sessionId required for admin_low_commitment");
        results = await notifyAdminLowCommitment(supabase, sessionId);
        break;

      case "session_cancelled":
        if (!sessionId) throw new Error("sessionId required for session_cancelled");
        results = await notifySessionCancelled(supabase, sessionId);
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

  // Generate calendar URL for the session
  const calendarUrl = generateGoogleCalendarUrl(
    `🏓 ${session.pool.name} Pickleball`,
    "Location TBD",
    session.proposed_date,
    session.proposed_time,
    90,
    `${APP_URL}/s/${sessionId}`
  );

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
          <p style="margin: 12px 0 0 0;"><a href="${calendarUrl}" style="color: #3CBBB1; font-size: 14px;">📅 Add to Google Calendar</a></p>
        </div>
        <p>Are you in? Click below to opt in!</p>
      `,
      ctaText: "View Session",
      ctaUrl: `${APP_URL}/s/${sessionId}`,
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
  // Get session with pool info including owner
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, pool:pools(id, name, owner_id)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Get the pool owner's Venmo account
  const { data: ownerPlayer, error: ownerError } = await supabase
    .from("players")
    .select("venmo_account")
    .eq("user_id", session.pool.owner_id)
    .single();

  const adminVenmo = ownerPlayer?.venmo_account;
  if (!adminVenmo) {
    console.warn("Pool owner has no Venmo account configured");
  }

  // Get pending payments with player info
  // Note: Must use !inner to filter on nested relation
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(`
      id, amount,
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

    // Generate a PAY link (guest pays admin) with hashtag for auto-reconciliation
    const venmoPayLink = adminVenmo 
      ? generateVenmoPayLink(adminVenmo, payment.amount, session.proposed_date, session.proposed_time, session.pool.name, payment.id)
      : null;

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
      ctaUrl: venmoPayLink || `${APP_URL}/s/${sessionId}`,
      secondaryCtaText: "View Session",
      secondaryCtaUrl: `${APP_URL}/s/${sessionId}`,
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
    .select("id, proposed_date, proposed_time, pool:pools(id, name, owner_id)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Get the pool owner's Venmo account
  const { data: ownerPlayer } = await supabase
    .from("players")
    .select("venmo_account")
    .eq("user_id", session.pool.owner_id)
    .single();

  const adminVenmo = ownerPlayer?.venmo_account;

  // Only get PENDING payments
  // Note: Must use !inner to filter on nested relation
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(`
      id, amount,
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

    // Generate a PAY link (guest pays admin) with hashtag for auto-reconciliation
    const venmoPayLink = adminVenmo 
      ? generateVenmoPayLink(adminVenmo, payment.amount, session.proposed_date, session.proposed_time, session.pool.name, payment.id)
      : null;

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
      ctaUrl: venmoPayLink || `${APP_URL}/s/${sessionId}`,
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

async function notifySessionReminder(supabase: ReturnType<typeof createClient>, sessionId: string, testEmail?: string) {
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, court_location, court_numbers, pool:pools(id, name, owner_id)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Get the pool owner's Venmo account for payment links
  const { data: ownerPlayer } = await supabase
    .from("players")
    .select("venmo_account")
    .eq("user_id", session.pool.owner_id)
    .single();

  const adminVenmo = ownerPlayer?.venmo_account;

  // Get all committed AND paid participants (not just committed)
  const { data: participants, error: participantsError } = await supabase
    .from("session_participants")
    .select(`
      id,
      player:players(id, name, email, phone, notification_preferences)
    `)
    .eq("session_id", sessionId)
    .in("status", ["committed", "paid"]);

  if (participantsError) throw participantsError;

  // Get pending payments for this session to check who still owes
  const { data: pendingPayments } = await supabase
    .from("payments")
    .select(`
      id, amount,
      session_participant:session_participants!inner(id, player_id)
    `)
    .eq("session_participant.session_id", sessionId)
    .eq("status", "pending");

  // Create a map of player_id -> payment info
  const pendingPaymentsByPlayer = new Map<string, { id: string; amount: number }>();
  for (const payment of pendingPayments || []) {
    const playerId = (payment.session_participant as { player_id: string })?.player_id;
    if (playerId) {
      pendingPaymentsByPlayer.set(playerId, { id: payment.id, amount: payment.amount });
    }
  }

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
    
    // If testEmail is set, only notify that specific email
    if (testEmail && player.email !== testEmail) {
      continue;
    }
    
    // Check if this player has a pending payment
    const pendingPayment = pendingPaymentsByPlayer.get(player.id);
    const hasPendingPayment = !!pendingPayment;
    
    // Generate Venmo pay link if they have a pending payment
    let venmoPayLink: string | null = null;
    if (hasPendingPayment && adminVenmo) {
      venmoPayLink = generateVenmoPayLink(
        adminVenmo, 
        pendingPayment.amount, 
        session.proposed_date, 
        session.proposed_time, 
        session.pool.name, 
        pendingPayment.id
      );
    }
    
    // Send email if enabled
    if (player.email && player.notification_preferences?.email) {
      // Build payment reminder section if they still owe
      const paymentSection = hasPendingPayment ? `
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;"><strong>💰 Payment Due:</strong> $${pendingPayment.amount.toFixed(2)}</p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #92400e;">Please pay before the session!</p>
        </div>
      ` : "";

      // Generate calendar URL
      const calendarUrl = generateGoogleCalendarUrl(
        `🏓 ${session.pool.name} Pickleball`,
        session.court_location || "Location TBD",
        session.proposed_date,
        session.proposed_time,
        90, // Default duration for calendar
        `${APP_URL}/s/${sessionId}`
      );

      const html = emailTemplate({
        title,
        preheader: `${session.pool.name} session ${timeWord} at ${sessionTime}${hasPendingPayment ? ` - $${pendingPayment.amount.toFixed(2)} due` : ""}`,
        body: `
          <p>Hey ${getFirstName(player.name)}!</p>
          <p>Just a reminder - you're playing ${timeWord}!</p>
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>🏓 Pool:</strong> ${session.pool.name}</p>
            <p style="margin: 8px 0 0 0;"><strong>📅 Date:</strong> ${sessionDate}</p>
            <p style="margin: 8px 0 0 0;"><strong>⏰ Time:</strong> ${sessionTime}</p>
            ${session.court_location ? `<p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${session.court_location}</p>` : ""}
            ${session.court_numbers && session.court_numbers.length > 0 ? `<p style="margin: 8px 0 0 0;"><strong>🎾 Court${session.court_numbers.length > 1 ? 's' : ''}:</strong> ${session.court_numbers.join(', ')}</p>` : ""}
            <p style="margin: 12px 0 0 0;"><a href="${calendarUrl}" style="color: #3CBBB1; font-size: 14px;">📅 Add to Google Calendar</a></p>
          </div>
          ${paymentSection}
          <p>See you on the court!</p>
        `,
        ctaText: hasPendingPayment && venmoPayLink ? "Pay & View Session" : "View Session",
        ctaUrl: hasPendingPayment && venmoPayLink ? venmoPayLink : `${APP_URL}/s/${sessionId}`,
        secondaryCtaText: hasPendingPayment && venmoPayLink ? "View Session" : undefined,
        secondaryCtaUrl: hasPendingPayment && venmoPayLink ? `${APP_URL}/s/${sessionId}` : undefined,
      });

      try {
        const subjectPrefix = isToday ? "Today" : isTomorrow ? "Tomorrow" : sessionDate;
        const subjectSuffix = hasPendingPayment ? ` - $${pendingPayment.amount.toFixed(2)} due` : "";
        await sendEmail(player.email, `${subjectPrefix}: ${session.pool.name} at ${sessionTime}${subjectSuffix}`, html);
        results.sent++;
        await logNotification(supabase, "session_reminder", sessionId, player.id, "email", true);
      } catch (err) {
        results.failed++;
        results.errors.push(`${player.email}: ${(err as Error).message}`);
      }
    }

    // Send SMS if enabled and phone exists
    if (player.phone && player.notification_preferences?.sms) {
      const paymentNote = hasPendingPayment ? ` Don't forget to pay $${pendingPayment.amount.toFixed(2)}!` : "";
      const smsMessage = `🏓 DinkUp: ${session.pool.name} ${timeWord} at ${sessionTime}.${paymentNote} See you on the court!`;
      
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
      ctaUrl: `${APP_URL}/s/${sessionId}`,
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
    const smsMessage = `🎉 DinkUp: You're in! Promoted from waitlist for ${session.pool.name} on ${sessionDate} at ${sessionTime}. View: ${APP_URL}/s/${sessionId}`;
    
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

  // SMS disabled until Twilio number is verified
  if (SMS_DISABLED) {
    console.log(`[SMS DISABLED] Skipping SMS to: ${to}`);
    console.log(`[SMS DISABLED] Message would be: ${message}`);
    return { sid: `disabled-${Date.now()}`, message: "SMS disabled - awaiting Twilio verification" };
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

// Generate a Venmo PAY link (for guest to pay admin)
// Includes hashtag with payment ID for auto-reconciliation
function generateVenmoPayLink(
  adminVenmo: string,
  amount: number,
  sessionDate: string,
  sessionTime: string,
  poolName: string,
  paymentId: string
): string {
  const date = new Date(sessionDate + "T" + sessionTime);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  // Create note with hashtag for auto-matching
  const note = `Pickleball - ${poolName} - ${formattedDate} @ ${formattedTime} #dinkup-${paymentId}`;

  // txn=pay means the user will PAY the recipient
  return `https://venmo.com/${encodeURIComponent(adminVenmo)}?txn=pay&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`;
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
              <img src="${APP_URL}/logo.png" alt="DinkUp" width="120" height="auto" style="max-width: 120px; height: auto; margin-bottom: 8px;" />
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

// ============================================
// COMMITMENT REMINDER (for uncommitted players)
// ============================================

async function notifyCommitmentReminder(supabase: ReturnType<typeof createClient>, sessionId: string) {
  // Get session details
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, min_players, court_location, pool:pools(id, name)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Get pool members who haven't committed yet
  const { data: uncommittedPlayers, error: playersError } = await supabase
    .from("pool_players")
    .select("player:players(id, name, email, phone, notification_preferences)")
    .eq("pool_id", session.pool.id)
    .eq("is_active", true);

  if (playersError) throw playersError;

  // Get players who have already responded (committed, paid, maybe, or opted_out)
  const { data: respondedParticipants } = await supabase
    .from("session_participants")
    .select("player_id")
    .eq("session_id", sessionId);

  const respondedIds = new Set((respondedParticipants || []).map(p => p.player_id));

  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const sessionDate = formatDate(session.proposed_date);
  const sessionTime = formatTime(session.proposed_time);

  // Generate calendar URL
  const calendarUrl = generateGoogleCalendarUrl(
    `🏓 ${session.pool.name} Pickleball`,
    session.court_location || "Location TBD",
    session.proposed_date,
    session.proposed_time,
    90,
    `${APP_URL}/s/${sessionId}`
  );

  for (const pp of uncommittedPlayers || []) {
    const player = pp.player as Player;
    
    // Skip if already responded
    if (respondedIds.has(player.id)) continue;
    
    if (!player.email || !player.notification_preferences?.email) continue;

    const html = emailTemplate({
      title: "Are You In? 🏓",
      preheader: `${session.pool.name} needs your RSVP for ${sessionDate}`,
      body: `
        <p>Hey ${getFirstName(player.name)}!</p>
        <p>We're trying to get a headcount for the upcoming <strong>${session.pool.name}</strong> session:</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>📅 Date:</strong> ${sessionDate}</p>
          <p style="margin: 8px 0 0 0;"><strong>⏰ Time:</strong> ${sessionTime}</p>
          ${session.court_location ? `<p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${session.court_location}</p>` : ""}
          <p style="margin: 12px 0 0 0;"><a href="${calendarUrl}" style="color: #3CBBB1; font-size: 14px;">📅 Add to Google Calendar</a></p>
        </div>
        <p>Please let us know if you can make it!</p>
      `,
      ctaText: "I'm In!",
      ctaUrl: `${APP_URL}/s/${sessionId}`,
      secondaryCtaText: "View Session Details",
      secondaryCtaUrl: `${APP_URL}/s/${sessionId}`,
    });

    try {
      await sendEmail(player.email, `RSVP Needed: ${session.pool.name} - ${sessionDate}`, html);
      results.sent++;
      await logNotification(supabase, "commitment_reminder", sessionId, player.id, "email", true);
    } catch (err) {
      results.failed++;
      results.errors.push(`${player.email}: ${(err as Error).message}`);
    }
  }

  return results;
}

// ============================================
// ADMIN LOW COMMITMENT ALERT
// ============================================

async function notifyAdminLowCommitment(supabase: ReturnType<typeof createClient>, sessionId: string) {
  // Get session details with pool and owner
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, min_players, court_location, pool:pools(id, name, owner_id)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Get current committed count
  const { count: committedCount } = await supabase
    .from("session_participants")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .in("status", ["committed", "paid"]);

  const committed = committedCount || 0;
  const minPlayers = session.min_players || 4;

  // Only alert if below minimum
  if (committed >= minPlayers) {
    return { sent: 0, failed: 0, errors: [], message: "Enough players committed" };
  }

  // Get the pool owner (admin)
  const { data: owner, error: ownerError } = await supabase
    .from("players")
    .select("id, name, email, notification_preferences")
    .eq("user_id", session.pool.owner_id)
    .single();

  if (ownerError || !owner) throw new Error("Pool owner not found");

  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const sessionDate = formatDate(session.proposed_date);
  const sessionTime = formatTime(session.proposed_time);
  const needed = minPlayers - committed;

  if (owner.email) {
    const html = emailTemplate({
      title: "⚠️ Low Commitment Alert",
      preheader: `Only ${committed}/${minPlayers} committed for ${sessionDate}`,
      body: `
        <p>Hey ${getFirstName(owner.name)}!</p>
        <p>Your <strong>${session.pool.name}</strong> session is coming up, but commitment is low:</p>
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;"><strong>📅 Date:</strong> ${sessionDate} at ${sessionTime}</p>
          <p style="margin: 8px 0 0 0; color: #92400e;"><strong>👥 Committed:</strong> ${committed} / ${minPlayers} minimum</p>
          <p style="margin: 8px 0 0 0; color: #92400e;"><strong>🔢 Need ${needed} more player${needed > 1 ? 's' : ''}</strong></p>
        </div>
        <p>You may want to:</p>
        <ul style="margin: 16px 0; padding-left: 24px; color: #3f3f46;">
          <li>Send a reminder to uncommitted players</li>
          <li>Reach out to specific people directly</li>
          <li>Consider cancelling if you can't fill the session</li>
        </ul>
      `,
      ctaText: "Manage Session",
      ctaUrl: `${APP_URL}/s/${sessionId}`,
    });

    try {
      await sendEmail(owner.email, `⚠️ ${session.pool.name}: Only ${committed}/${minPlayers} committed for ${sessionDate}`, html);
      results.sent++;
      await logNotification(supabase, "admin_low_commitment", sessionId, owner.id, "email", true);
    } catch (err) {
      results.failed++;
      results.errors.push(`${owner.email}: ${(err as Error).message}`);
    }
  }

  return results;
}

async function notifySessionCancelled(supabase: ReturnType<typeof createClient>, sessionId: string) {
  // Get session details with pool
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, proposed_date, proposed_time, court_location, pool:pools(id, name)")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) throw new Error("Session not found");

  // Get all session participants (both committed and waitlisted)
  const { data: participants, error: participantsError } = await supabase
    .from("session_participants")
    .select("player:players(id, name, email, phone, notification_preferences)")
    .eq("session_id", sessionId);

  if (participantsError) throw participantsError;

  const results = { sent: 0, failed: 0, errors: [] as string[] };
  const sessionDate = formatDate(session.proposed_date);
  const sessionTime = formatTime(session.proposed_time);
  const location = session.court_location || "Location TBD";

  for (const participant of participants || []) {
    const player = participant.player as Player;
    if (!player) continue;

    // Send email notification
    if (player.email && player.notification_preferences?.email) {
      const html = emailTemplate({
        title: "Session Cancelled ❌",
        preheader: `${session.pool.name} - ${sessionDate} has been cancelled`,
        body: `
          <p>Hey ${getFirstName(player.name)}!</p>
          <p>We're sorry to inform you that the following pickleball session has been cancelled:</p>
          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ef4444;">
            <p style="margin: 0; color: #7f1d1d;"><strong>📅 Date:</strong> ${sessionDate}</p>
            <p style="margin: 8px 0 0 0; color: #7f1d1d;"><strong>⏰ Time:</strong> ${sessionTime}</p>
            <p style="margin: 8px 0 0 0; color: #7f1d1d;"><strong>📍 Location:</strong> ${location}</p>
            <p style="margin: 8px 0 0 0; color: #7f1d1d;"><strong>🏓 Pool:</strong> ${session.pool.name}</p>
          </div>
          <p>We hope to see you at the next session!</p>
        `,
        ctaText: "View Pool",
        ctaUrl: `${APP_URL}/p/${session.pool.id}`,
      });

      try {
        await sendEmail(player.email, `Session Cancelled: ${session.pool.name} - ${sessionDate}`, html);
        results.sent++;
        await logNotification(supabase, "session_cancelled", sessionId, player.id, "email", true);
      } catch (err) {
        results.failed++;
        results.errors.push(`${player.email}: ${(err as Error).message}`);
        await logNotification(supabase, "session_cancelled", sessionId, player.id, "email", false, (err as Error).message);
      }
    }

    // Send SMS notification
    if (!SMS_DISABLED && player.phone && player.notification_preferences?.sms) {
      const smsMessage = `🏓 Session Cancelled: ${session.pool.name} on ${sessionDate} at ${sessionTime} has been cancelled. We hope to see you at the next session! View pool: ${APP_URL}/p/${session.pool.id}`;

      try {
        await sendSMS(player.phone, smsMessage);
        results.sent++;
        await logNotification(supabase, "session_cancelled", sessionId, player.id, "sms", true);
      } catch (err) {
        results.failed++;
        results.errors.push(`${player.phone}: ${(err as Error).message}`);
        await logNotification(supabase, "session_cancelled", sessionId, player.id, "sms", false, (err as Error).message);
      }
    }
  }

  return results;
}
