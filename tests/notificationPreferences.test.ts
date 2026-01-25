import { describe, it, expect, beforeAll } from 'vitest'
import { supabase } from '../src/lib/supabase'
import { getFirstPool, createTestSession } from './setup'
import { 
  getUserPreferences, 
  updatePreference, 
  shouldNotify,
  initializeDefaultPreferences,
  NotificationType 
} from '../src/lib/notificationPreferences'

describe('Notification Preferences', () => {
  let testUserId: string
  let testPoolId: string

  beforeAll(async () => {
    const pool = await getFirstPool()
    testPoolId = pool.id
    testUserId = pool.owner_id
  })

  it('should get default preferences for user', async () => {
    const prefs = await getUserPreferences(testUserId)
    
    expect(prefs.size).toBeGreaterThanOrEqual(5)
    
    // Check defaults: email ON, SMS OFF
    const sessionReminderPref = prefs.get('session_reminder_24h')
    expect(sessionReminderPref).toBeDefined()
    expect(sessionReminderPref?.email_enabled).toBe(true)
    expect(sessionReminderPref?.sms_enabled).toBe(false)
  })

  it('should update single preference', async () => {
    // Enable SMS for session reminders
    await updatePreference(testUserId, 'session_reminder_24h', true, true)
    
    const prefs = await getUserPreferences(testUserId)
    const pref = prefs.get('session_reminder_24h')
    
    expect(pref?.email_enabled).toBe(true)
    expect(pref?.sms_enabled).toBe(true)
  })

  it('should disable email for specific type', async () => {
    // Disable email for payment reminders
    await updatePreference(testUserId, 'payment_reminder', false, false)
    
    const prefs = await getUserPreferences(testUserId)
    const pref = prefs.get('payment_reminder')
    
    expect(pref?.email_enabled).toBe(false)
    expect(pref?.sms_enabled).toBe(false)
  })

  it('should check if user should be notified via email', async () => {
    // Reset to defaults
    await updatePreference(testUserId, 'payment_request', true, false)
    
    const shouldEmail = await shouldNotify(testUserId, 'payment_request', 'email')
    const shouldSms = await shouldNotify(testUserId, 'payment_request', 'sms')
    
    expect(shouldEmail).toBe(true)
    expect(shouldSms).toBe(false)
  })

  it('should check if user should be notified via SMS', async () => {
    // Enable SMS for payment requests
    await updatePreference(testUserId, 'payment_request', true, true)
    
    const shouldSms = await shouldNotify(testUserId, 'payment_request', 'sms')
    expect(shouldSms).toBe(true)
  })

  it('should initialize default preferences for new user', async () => {
    // Create a test user
    const { data: authData } = await supabase.auth.signUp({
      email: `test-prefs-${Date.now()}@test.com`,
      password: 'test123456',
    })
    
    if (!authData.user) throw new Error('Failed to create test user')
    
    await initializeDefaultPreferences(authData.user.id)
    
    const prefs = await getUserPreferences(authData.user.id)
    expect(prefs.size).toBe(5)
    
    // All should have email ON, SMS OFF
    prefs.forEach((pref, type) => {
      expect(pref.email_enabled).toBe(true)
      expect(pref.sms_enabled).toBe(false)
    })
  })

  it('should allow independent email and SMS toggles', async () => {
    // Email ON, SMS OFF
    await updatePreference(testUserId, 'session_reminder_24h', true, false)
    let pref = (await getUserPreferences(testUserId)).get('session_reminder_24h')
    expect(pref?.email_enabled).toBe(true)
    expect(pref?.sms_enabled).toBe(false)
    
    // Email OFF, SMS ON
    await updatePreference(testUserId, 'session_reminder_24h', false, true)
    pref = (await getUserPreferences(testUserId)).get('session_reminder_24h')
    expect(pref?.email_enabled).toBe(false)
    expect(pref?.sms_enabled).toBe(true)
    
    // Both OFF
    await updatePreference(testUserId, 'session_reminder_24h', false, false)
    pref = (await getUserPreferences(testUserId)).get('session_reminder_24h')
    expect(pref?.email_enabled).toBe(false)
    expect(pref?.sms_enabled).toBe(false)
    
    // Both ON
    await updatePreference(testUserId, 'session_reminder_24h', true, true)
    pref = (await getUserPreferences(testUserId)).get('session_reminder_24h')
    expect(pref?.email_enabled).toBe(true)
    expect(pref?.sms_enabled).toBe(true)
  })

  it('should support all notification types', async () => {
    const types: NotificationType[] = [
      'session_reminder_24h',
      'payment_request',
      'payment_reminder',
      'waitlist_promotion',
      'session_cancelled',
    ]
    
    for (const type of types) {
      await updatePreference(testUserId, type, true, false)
      const shouldEmail = await shouldNotify(testUserId, type, 'email')
      expect(shouldEmail).toBe(true)
    }
  })

  it('should persist preferences across sessions', async () => {
    // Set specific preferences
    await updatePreference(testUserId, 'payment_reminder', false, true)
    
    // Fetch again (simulating page reload)
    const prefs = await getUserPreferences(testUserId)
    const pref = prefs.get('payment_reminder')
    
    expect(pref?.email_enabled).toBe(false)
    expect(pref?.sms_enabled).toBe(true)
  })

  it('should handle missing preferences with defaults', async () => {
    // Create a user without initializing preferences
    const { data: authData } = await supabase.auth.signUp({
      email: `test-no-prefs-${Date.now()}@test.com`,
      password: 'test123456',
    })
    
    if (!authData.user) throw new Error('Failed to create test user')
    
    // Should return defaults even without DB rows
    const shouldEmail = await shouldNotify(authData.user.id, 'session_reminder_24h', 'email')
    const shouldSms = await shouldNotify(authData.user.id, 'session_reminder_24h', 'sms')
    
    expect(shouldEmail).toBe(true) // Default email ON
    expect(shouldSms).toBe(false) // Default SMS OFF
  })
})
