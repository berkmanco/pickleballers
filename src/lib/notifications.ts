// Client-side notification service
// Calls Supabase edge functions to send notifications

import { supabase } from './supabase';

export type NotificationType = 
  | 'session_created'
  | 'roster_locked'
  | 'payment_reminder'
  | 'session_reminder'
  | 'waitlist_promoted';

interface NotifyResult {
  success: boolean;
  sent?: number;
  failed?: number;
  errors?: string[];
  error?: string;
}

/**
 * Send notifications for a specific event
 */
export async function sendNotification(
  type: NotificationType,
  options: {
    sessionId?: string;
    playerId?: string;
    customMessage?: string;
  }
): Promise<NotifyResult> {
  const { data, error } = await supabase.functions.invoke('notify', {
    body: {
      type,
      sessionId: options.sessionId,
      playerId: options.playerId,
      customMessage: options.customMessage,
    },
  });

  if (error) {
    console.error('Notification error:', error);
    return { success: false, error: error.message };
  }

  return data as NotifyResult;
}

/**
 * Notify pool members about a new session
 */
export async function notifySessionCreated(sessionId: string): Promise<NotifyResult> {
  return sendNotification('session_created', { sessionId });
}

/**
 * Notify guests about roster lock and payment due
 */
export async function notifyRosterLocked(sessionId: string): Promise<NotifyResult> {
  return sendNotification('roster_locked', { sessionId });
}

/**
 * Send payment reminder to guests with pending payments
 */
export async function notifyPaymentReminder(
  sessionId: string, 
  customMessage?: string
): Promise<NotifyResult> {
  return sendNotification('payment_reminder', { sessionId, customMessage });
}

/**
 * Send session reminder (24h before)
 */
export async function notifySessionReminder(sessionId: string): Promise<NotifyResult> {
  return sendNotification('session_reminder', { sessionId });
}

/**
 * Notify a player they've been promoted from waitlist
 */
export async function notifyWaitlistPromoted(
  sessionId: string, 
  playerId: string
): Promise<NotifyResult> {
  return sendNotification('waitlist_promoted', { sessionId, playerId });
}

/**
 * Get notification log for a session (admin only)
 */
export async function getSessionNotificationLog(sessionId: string) {
  const { data, error } = await supabase
    .from('notifications_log')
    .select(`
      id,
      type,
      channel,
      success,
      error_message,
      created_at,
      player:players(name, email)
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notification log:', error);
    return [];
  }

  return data || [];
}
