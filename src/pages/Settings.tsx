import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Format E.164 phone number for display: +16145376574 -> (614) 537-6574
function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return ''
  // Remove +1 prefix if present
  const digits = phone.replace(/\D/g, '')
  const nationalNumber = digits.startsWith('1') ? digits.slice(1) : digits
  if (nationalNumber.length === 10) {
    return `(${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`
  }
  return phone // Return as-is if not a standard US number
}

// Convert display format to E.164: (614) 537-6574 -> +16145376574
function formatPhoneE164(phone: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  return null // Invalid
}

// Validate phone number
function isValidPhone(phone: string): boolean {
  if (!phone) return true // Empty is valid (optional field)
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
}

// Auto-format phone as user types: 6145376574 -> (614) 537-6574
function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10) // Max 10 digits
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

interface Player {
  id: string
  name: string
  email: string
  phone: string | null
  venmo_account: string
  notification_preferences: {
    email: boolean
    sms: boolean
  }
}

export default function Settings() {
  const { user } = useAuth()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [venmoAccount, setVenmoAccount] = useState('')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(false)

  useEffect(() => {
    if (!user) return

    const userId = user.id

    async function loadPlayer() {
      try {
        setLoading(true)
        const { data, error: fetchError } = await supabase
          .from('players')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (fetchError) throw fetchError

        if (data) {
          setPlayer(data)
          setName(data.name || '')
          setPhone(formatPhoneDisplay(data.phone))
          setVenmoAccount(data.venmo_account || '')
          setEmailNotifications(data.notification_preferences?.email ?? true)
          setSmsNotifications(data.notification_preferences?.sms ?? false)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadPlayer()
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!player) return

    // Validate phone if provided
    if (phone && !isValidPhone(phone)) {
      setError('Please enter a valid 10-digit US phone number')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const { error: updateError } = await supabase
        .from('players')
        .update({
          name,
          phone: formatPhoneE164(phone),
          venmo_account: venmoAccount,
          notification_preferences: {
            email: emailNotifications,
            sms: smsNotifications,
          },
        })
        .eq('id', player.id)

      if (updateError) throw updateError

      setSuccess('Settings saved successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3CBBB1]"></div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Profile Found</h2>
          <p className="text-yellow-700">
            You need to be registered in a pool to have a player profile.
          </p>
          <Link
            to="/dashboard"
            className="text-[#3CBBB1] hover:text-[#35a8a0] mt-4 inline-block"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="text-[#3CBBB1] hover:text-[#35a8a0] text-sm mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your profile and notification preferences</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-gray-500 bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-500">Email is managed by your login</p>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="(614) 537-6574"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Required for SMS notifications</p>
            </div>

            <div>
              <label htmlFor="venmo" className="block text-sm font-medium text-gray-700 mb-1">
                Venmo Username <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                <input
                  type="text"
                  id="venmo"
                  required
                  value={venmoAccount}
                  onChange={(e) => setVenmoAccount(e.target.value.replace('@', ''))}
                  placeholder="your-venmo-username"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Used for payment requests</p>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
          <p className="text-sm text-gray-600 mb-4">
            Choose how you want to receive updates about sessions and payments.
          </p>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="mt-1 h-4 w-4 text-[#3CBBB1] border-gray-300 rounded focus:ring-[#3CBBB1]"
              />
              <div>
                <span className="font-medium text-gray-900">Email Notifications</span>
                <p className="text-sm text-gray-500">
                  Receive emails for new sessions, payment requests, and reminders
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={smsNotifications}
                onChange={(e) => setSmsNotifications(e.target.checked)}
                disabled={!phone}
                className="mt-1 h-4 w-4 text-[#3CBBB1] border-gray-300 rounded focus:ring-[#3CBBB1] disabled:opacity-50"
              />
              <div>
                <span className={`font-medium ${phone ? 'text-gray-900' : 'text-gray-400'}`}>
                  SMS Notifications
                </span>
                <p className="text-sm text-gray-500">
                  {phone 
                    ? 'Receive text messages for time-sensitive updates (24h reminders, waitlist promotions)'
                    : 'Add a phone number to enable SMS notifications'
                  }
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-[#3CBBB1] text-white py-2 px-6 rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
