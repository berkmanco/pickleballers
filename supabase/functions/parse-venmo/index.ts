// Supabase Edge Function: parse-venmo
// Receives parsed Venmo emails from Cloudflare Email Worker
// Extracts transaction data and updates payment status

// Deno runtime type declaration
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
const VENMO_WEBHOOK_SECRET = Deno.env.get("VENMO_WEBHOOK_SECRET");

interface VenmoEmailPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  date?: string;
  messageId?: string;
}

interface ParsedTransaction {
  transaction_type: "payment_sent" | "payment_received" | "request_sent" | "request_received";
  amount: number;
  sender_name: string;
  recipient_name: string;
  note: string | null;
  hashtag: string | null;
  email_subject: string;
  email_from: string;
  transaction_date: string | null;
}

serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Security: Verify secret header
  const secret = req.headers.get("X-Venmo-Webhook-Secret");
  
  // Debug logging
  console.log("All headers:", Object.fromEntries(req.headers.entries()));
  console.log("Received secret (first 8 chars):", secret?.substring(0, 8) || "NULL");
  console.log("Expected secret (first 8 chars):", VENMO_WEBHOOK_SECRET?.substring(0, 8) || "NOT_SET");
  
  if (!VENMO_WEBHOOK_SECRET) {
    console.error("VENMO_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (secret !== VENMO_WEBHOOK_SECRET) {
    console.error("Invalid webhook secret - received:", secret?.substring(0, 8), "expected:", VENMO_WEBHOOK_SECRET.substring(0, 8));
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const payload: VenmoEmailPayload = await req.json();
    console.log("Received Venmo email payload:", {
      from: payload.from,
      subject: payload.subject,
      date: payload.date,
    });

    // Parse the email content
    const parsed = parseVenmoEmail(payload);
    if (!parsed) {
      console.log("Could not parse Venmo email - may not be a transaction email");
      return new Response(
        JSON.stringify({ success: true, message: "Email received but not a parseable transaction" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Parsed transaction:", parsed);

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Insert the transaction
    const { data: transaction, error: insertError } = await supabase
      .from("venmo_transactions")
      .insert({
        transaction_type: parsed.transaction_type,
        amount: parsed.amount,
        sender_name: parsed.sender_name,
        recipient_name: parsed.recipient_name,
        note: parsed.note,
        hashtag: parsed.hashtag,
        email_subject: parsed.email_subject,
        email_from: parsed.email_from,
        transaction_date: parsed.transaction_date,
        raw_json: payload,
        processed: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert transaction:", insertError);
      throw insertError;
    }

    console.log("Transaction inserted:", transaction.id);

    // Try to auto-match to a payment
    let matched = false;
    if (parsed.hashtag) {
      matched = await tryMatchByHashtag(supabase, transaction.id, parsed);
    }

    if (!matched && parsed.transaction_type === "payment_received") {
      // Try to match by amount + sender name for received payments
      matched = await tryMatchByAmountAndSender(supabase, transaction.id, parsed);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        matched,
        parsed: {
          type: parsed.transaction_type,
          amount: parsed.amount,
          hashtag: parsed.hashtag,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing Venmo email:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Parse a Venmo email to extract transaction details
 */
function parseVenmoEmail(payload: VenmoEmailPayload): ParsedTransaction | null {
  const { subject: rawSubject, text, html, from, date } = payload;
  const body = text || stripHtml(html || "");
  
  // Clean subject - remove "Fwd:", "Re:", etc.
  const subject = cleanSubject(rawSubject);

  // Regex patterns for Venmo subjects
  // "You paid [Name] $XX.XX"
  const youPaidMatch = subject.match(/You paid (.+?) \$?([\d,]+\.?\d*)/i);
  // "[Name] paid you $XX.XX"
  const paidYouMatch = subject.match(/(.+?) paid you \$?([\d,]+\.?\d*)/i);
  // "You requested $XX.XX from [Name]"
  const youRequestedMatch = subject.match(/You requested \$?([\d,]+\.?\d*) from (.+)/i);
  // "[Name] requests $XX.XX"
  const requestedFromYouMatch = subject.match(/(.+?) requests \$?([\d,]+\.?\d*)/i);

  let transactionType: ParsedTransaction["transaction_type"];
  let amount: number;
  let senderName: string;
  let recipientName: string;

  if (youPaidMatch) {
    transactionType = "payment_sent";
    recipientName = cleanName(youPaidMatch[1]);
    amount = parseAmount(youPaidMatch[2]);
    senderName = "You";
  } else if (paidYouMatch) {
    transactionType = "payment_received";
    senderName = cleanName(paidYouMatch[1]);
    amount = parseAmount(paidYouMatch[2]);
    recipientName = "You";
  } else if (youRequestedMatch) {
    transactionType = "request_sent";
    amount = parseAmount(youRequestedMatch[1]);
    recipientName = cleanName(youRequestedMatch[2]);
    senderName = "You";
  } else if (requestedFromYouMatch) {
    transactionType = "request_received";
    senderName = cleanName(requestedFromYouMatch[1]);
    amount = parseAmount(requestedFromYouMatch[2]);
    recipientName = "You";
  } else {
    // Not a transaction email we can parse
    return null;
  }

  // Extract note/hashtag from body, subject, or raw payload
  // Try multiple sources since forwarded emails may have note in different places
  const note = extractNote(body) || extractNote(rawSubject) || extractNote(JSON.stringify(payload));
  const hashtag = extractHashtag(body) || extractHashtag(note || "") || extractHashtag(rawSubject) || extractHashtag(JSON.stringify(payload));

  return {
    transaction_type: transactionType,
    amount,
    sender_name: senderName,
    recipient_name: recipientName,
    note,
    hashtag,
    email_subject: rawSubject, // Keep original for debugging
    email_from: from,
    transaction_date: date || null,
  };
}

/**
 * Clean email subject - remove forwarding prefixes
 */
function cleanSubject(subject: string): string {
  return subject
    .replace(/^(fwd|fw|re):\s*/gi, '') // Remove Fwd:, Fw:, Re:
    .trim();
}

/**
 * Clean name - remove any artifacts from parsing
 */
function cleanName(name: string): string {
  return name
    .replace(/^(fwd|fw|re):\s*/gi, '') // Remove Fwd: if it got captured
    .trim();
}

/**
 * Parse amount string to number
 * "16.00" -> 16.00
 * "1,234.56" -> 1234.56
 */
function parseAmount(amountStr: string): number {
  return parseFloat(amountStr.replace(/,/g, ""));
}

/**
 * Extract the payment note from email body
 * Venmo emails typically have the note in a specific section
 */
function extractNote(body: string): string | null {
  // Skip if body looks like CSS or HTML garbage
  if (isCssOrHtmlGarbage(body)) {
    return null;
  }
  
  // Common patterns in Venmo emails
  // The note is often after "Note:" or in quotes or a specific div
  
  // Pattern 1: Look for quoted text that's likely the note
  const quotedMatch = body.match(/"([^"]+)"/);
  if (quotedMatch && quotedMatch[1].length < 500 && !isCssOrHtmlGarbage(quotedMatch[1])) {
    return quotedMatch[1].trim();
  }

  // Pattern 2: Look for text after common delimiters
  const notePatterns = [
    /Note:\s*(.+?)(?:\n|$)/i,
    /Message:\s*(.+?)(?:\n|$)/i,
    /for\s+"([^"]+)"/i,
  ];

  for (const pattern of notePatterns) {
    const match = body.match(pattern);
    if (match && !isCssOrHtmlGarbage(match[1])) {
      return match[1].trim();
    }
  }

  // Pattern 3: Look for hashtag-containing line (but only valid hashtags)
  const hashtagLine = body.split("\n").find((line) => {
    if (!line.includes("#")) return false;
    // Must contain a dinkup/pay/session hashtag, not CSS colors
    return /#(dinkup|pay|payment|session)[-_]/i.test(line);
  });
  if (hashtagLine && hashtagLine.length < 500) {
    return hashtagLine.trim();
  }

  return null;
}

/**
 * Check if text looks like CSS or HTML garbage
 */
function isCssOrHtmlGarbage(text: string): boolean {
  if (!text) return true;
  
  // CSS patterns
  if (/font-family:|font-size:|color:#[0-9a-f]{3,6}|background:|margin:|padding:/i.test(text)) {
    return true;
  }
  
  // HTML patterns
  if (/<[a-z]+|&nbsp;|&amp;|style=|class=/i.test(text)) {
    return true;
  }
  
  // Mostly punctuation/special chars
  const alphanumeric = text.replace(/[^a-z0-9]/gi, '');
  if (alphanumeric.length < text.length * 0.3) {
    return true;
  }
  
  return false;
}

/**
 * Extract hashtag from text
 * Only match DinkUp-specific hashtags, not CSS color codes
 * "#dinkup-abc123" or "#pay-xyz" or "#session-xyz"
 */
function extractHashtag(text: string): string | null {
  // Only match hashtags that start with our prefixes
  // Excludes CSS color codes like #2f3033 or #ffffff
  const hashtagMatch = text.match(/#(dinkup|pay|payment|session)[-_][\w-]+/i);
  if (hashtagMatch) {
    return hashtagMatch[0];
  }
  
  // Also try to match any hashtag that contains a UUID pattern
  const uuidHashtagMatch = text.match(/#[\w-]*[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  if (uuidHashtagMatch) {
    return uuidHashtagMatch[0];
  }
  
  return null;
}

/**
 * Try to match transaction to a payment by hashtag
 * Hashtag format: #dinkup-{payment_id} or #session-{session_id}
 */
async function tryMatchByHashtag(
  supabase: ReturnType<typeof createClient>,
  transactionId: string,
  parsed: ParsedTransaction
): Promise<boolean> {
  if (!parsed.hashtag) return false;

  // Try to extract payment ID from hashtag
  // Format: #dinkup-{uuid} or #pay-{uuid}
  const paymentIdMatch = parsed.hashtag.match(/#(?:dinkup|pay|payment)-([a-f0-9-]{36})/i);
  
  if (paymentIdMatch) {
    const paymentId = paymentIdMatch[1];
    
    // Verify payment exists and amount matches
    const { data: payment } = await supabase
      .from("payments")
      .select("id, amount, status")
      .eq("id", paymentId)
      .single();

    if (payment && Math.abs(payment.amount - parsed.amount) < 0.01) {
      // Match found! Update both records
      await supabase
        .from("venmo_transactions")
        .update({
          payment_id: paymentId,
          matched_at: new Date().toISOString(),
          match_method: "auto_hashtag",
          processed: true,
        })
        .eq("id", transactionId);

      // Mark payment as paid
      if (payment.status === "pending") {
        await supabase
          .from("payments")
          .update({
            status: "paid",
            payment_date: new Date().toISOString(),
            notes: `Auto-matched from Venmo email (${parsed.hashtag})`,
          })
          .eq("id", paymentId);

        console.log(`Payment ${paymentId} auto-marked as paid via hashtag`);
      }

      return true;
    }
  }

  return false;
}

/**
 * Try to match by amount and sender name (fuzzy)
 * This is less reliable but can catch payments without hashtags
 */
async function tryMatchByAmountAndSender(
  supabase: ReturnType<typeof createClient>,
  transactionId: string,
  parsed: ParsedTransaction
): Promise<boolean> {
  // Only try this for received payments
  if (parsed.transaction_type !== "payment_received") return false;

  // Look for pending payments with matching amount from recent sessions
  const { data: matchingPayments } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      session_participants!inner (
        players!inner (
          name
        )
      )
    `)
    .eq("status", "pending")
    .eq("amount", parsed.amount)
    .limit(10);

  if (!matchingPayments || matchingPayments.length === 0) return false;

  // Try to fuzzy match sender name
  const senderNameLower = parsed.sender_name.toLowerCase();
  
  for (const payment of matchingPayments) {
    const playerName = (payment as any).session_participants?.players?.name?.toLowerCase();
    if (playerName && (
      playerName.includes(senderNameLower) ||
      senderNameLower.includes(playerName) ||
      fuzzyNameMatch(playerName, senderNameLower)
    )) {
      // Potential match - but don't auto-mark, just link for review
      await supabase
        .from("venmo_transactions")
        .update({
          payment_id: payment.id,
          matched_at: new Date().toISOString(),
          match_method: "auto_amount",
          processed: false, // Keep as unprocessed for manual review
        })
        .eq("id", transactionId);

      console.log(`Potential match found for payment ${payment.id} - needs manual review`);
      return true;
    }
  }

  return false;
}

/**
 * Simple fuzzy name matching
 * "Mike B" matches "Mike Berkman"
 * "Michael" matches "Mike" (common nicknames)
 */
function fuzzyNameMatch(name1: string, name2: string): boolean {
  const parts1 = name1.split(" ");
  const parts2 = name2.split(" ");

  // Check if first names match (even partially)
  if (parts1[0] && parts2[0]) {
    if (parts1[0].startsWith(parts2[0]) || parts2[0].startsWith(parts1[0])) {
      return true;
    }
  }

  // Check common nickname mappings
  const nicknames: Record<string, string[]> = {
    mike: ["michael", "mikey"],
    michael: ["mike", "mikey"],
    john: ["jon", "johnny", "jonathan"],
    jon: ["john", "johnny", "jonathan"],
    jonathan: ["john", "jon"],
    matt: ["matthew", "matty"],
    matthew: ["matt", "matty"],
    dan: ["daniel", "danny"],
    daniel: ["dan", "danny"],
    rob: ["robert", "robby", "bob"],
    robert: ["rob", "robby", "bob"],
    will: ["william", "bill", "billy"],
    william: ["will", "bill", "billy"],
    chris: ["christopher"],
    christopher: ["chris"],
  };

  const firstName1 = parts1[0];
  const firstName2 = parts2[0];

  if (nicknames[firstName1]?.includes(firstName2)) return true;
  if (nicknames[firstName2]?.includes(firstName1)) return true;

  return false;
}

/**
 * Strip HTML tags
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
