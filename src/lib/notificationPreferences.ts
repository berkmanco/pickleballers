import { supabase } from './supabase'

export type NotificationType =
  | 'session_reminder_24h'
  | 'payment_request'
  | 'payment_reminder'
  | 'waitlist_promotion'
  | 'session_cancelled'
  | 'pool_invitation'

export interface NotificationPreference {
  id: string
  user_id: string
  notification_type: NotificationType
  email_enabled: boolean
  sms_enabled: boolean
  created_at?: string
  updated_at?: string
}

// Notification type metadata
export const NOTIFICATION_TYPES = {
  session_reminder_24h: {
    label: '24-hour session reminders',
    description: 'Reminder sent 24 hours before your session',
    smsDisclosure: 'Receive SMS for 24-hour game reminders. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe.',
    supportsEmail: true,
    supportsSMS: true,
  },
  payment_request: {
    label: 'Payment requests',
    description: 'Notification when you owe money for a session',
    smsDisclosure: 'Receive SMS for payment requests. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe.',
    supportsEmail: true,
    supportsSMS: true,
  },
  payment_reminder: {
    label: 'Payment reminders',
    description: 'Reminder for unpaid balances',
    smsDisclosure: 'Receive SMS for payment reminders. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe.',
    supportsEmail: true,
    supportsSMS: true,
  },
  waitlist_promotion: {
    label: 'Waitlist promotions',
    description: 'When you move from waitlist to committed',
    smsDisclosure: null, // Email only
    supportsEmail: true,
    supportsSMS: false,
  },
  session_cancelled: {
    label: 'Session cancellations',
    description: 'When a session is cancelled',
    smsDisclosure: null, // Email only
    supportsEmail: true,
    supportsSMS: false,
  },
  pool_invitation: {
    label: 'Pool invitations',
    description: 'When invited to join a pool',
    smsDisclosure: null, // Email only
    supportsEmail: true,
    supportsSMS: false,
  },
} as const

// Default preferences for new users
const DEFAULT_PREFERENCES: Record<NotificationType, { email: boolean; sms: boolean }> = {
  session_reminder_24h: { email: true, sms: false },
  payment_request: { email: true, sms: false },
  payment_reminder: { email: true, sms: false },
  waitlist_promotion: { email: true, sms: false },
  session_cancelled: { email: true, sms: false },
  pool_invitation: { email: true, sms: false },
}

/**
 * Get user's notification preferences for all types
 * Returns defaults for any types not yet in database
 */
export async function getUserPreferences(
  userId: string
): Promise<Map<NotificationType, NotificationPreference>> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)

  if (error) throw error

  const prefsMap = new Map<NotificationType, NotificationPreference>()

  // Add existing preferences
  if (data) {
    data.forEach((pref) => {
      prefsMap.set(pref.notification_type as NotificationType, pref)
    })
  }

  // Fill in defaults for missing types
  Object.keys(DEFAULT_PREFERENCES).forEach((type) => {
    if (!prefsMap.has(type as NotificationType)) {
      const defaults = DEFAULT_PREFERENCES[type as NotificationType]
      prefsMap.set(type as NotificationType, {
        id: '', // Not yet in DB
        user_id: userId,
        notification_type: type as NotificationType,
        email_enabled: defaults.email,
        sms_enabled: defaults.sms,
      })
    }
  })

  return prefsMap
}

/**
 * Update a single notification preference
 * Creates if doesn't exist, updates if it does
 */
export async function updatePreference(
  userId: string,
  notificationType: NotificationType,
  emailEnabled: boolean,
  smsEnabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        notification_type: notificationType,
        email_enabled: emailEnabled,
        sms_enabled: smsEnabled,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,notification_type',
      }
    )

  if (error) throw error
}

/**
 * Check if user should receive a specific notification via specific channel
 * Used by notification sending logic
 */
export async function shouldNotify(
  userId: string,
  notificationType: NotificationType,
  channel: 'email' | 'sms'
): Promise<boolean> {
  // Get preference for this specific type
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('email_enabled, sms_enabled')
    .eq('user_id', userId)
    .eq('notification_type', notificationType)
    .maybeSingle()

  if (error) throw error

  // If no preference exists, use defaults
  if (!data) {
    const defaults = DEFAULT_PREFERENCES[notificationType]
    return channel === 'email' ? defaults.email : defaults.sms
  }

  return channel === 'email' ? data.email_enabled : data.sms_enabled
}

/**
 * Initialize default preferences for a new user
 * Called after user signs up
 */
export async function initializeDefaultPreferences(userId: string): Promise<void> {
  const preferences = Object.entries(DEFAULT_PREFERENCES).map(([type, defaults]) => ({
    user_id: userId,
    notification_type: type,
    email_enabled: defaults.email,
    sms_enabled: defaults.sms,
  }))

  const { error } = await supabase
    .from('notification_preferences')
    .insert(preferences)
    .select()

  if (error) {
    // Ignore duplicate errors (user may already have preferences)
    if (!error.message.includes('duplicate')) {
      throw error
    }
  }
}
