import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  validateRegistrationToken,
  registerPlayer,
  RegistrationData,
  RegistrationLinkWithPool,
} from '../lib/registration'
import { useAuth } from '../contexts/AuthContext'

export default function Register() {
  const { token, slug } = useParams<{ token?: string; slug?: string }>()
  const { signIn } = useAuth()
  const [link, setLink] = useState<RegistrationLinkWithPool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  // Debug: log parameters on mount
  useEffect(() => {
    console.log('Register page mounted, token:', token, 'slug:', slug)
  }, [token, slug])

  const [formData, setFormData] = useState<RegistrationData>({
    name: '',
    phone: '',
    email: '',
    venmo_account: '',
    notification_preferences: {
      email: true,
      sms: false,
    },
  })

  useEffect(() => {
    if (!token && !slug) {
      setError('Invalid registration link')
      setLoading(false)
      return
    }

    async function validateLink() {
      try {
        setLoading(true)
        setError(null)
        
        if (token) {
          // Old token-based flow
          const linkData = await validateRegistrationToken(token)
          setLink(linkData)
        } else if (slug) {
          // New slug-based flow - validate pool slug
          const linkData = await validateRegistrationToken(slug)
          setLink(linkData)
        }
      } catch (err: any) {
        console.error('Registration validation error:', err)
        setError(err.message || 'Invalid or expired registration link')
      } finally {
        setLoading(false)
      }
    }

    validateLink()
  }, [token, slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token && !slug) return

    try {
      setSubmitting(true)
      setError(null)
      // Use token if available, otherwise use slug
      await registerPlayer(token || slug!, formData)
      setSuccess(true)
      
      // Auto-send magic link to log them in
      try {
        await signIn(formData.email)
        setMagicLinkSent(true)
      } catch (signInErr) {
        // Registration succeeded but magic link failed - still show success
        console.log('Magic link send failed:', signInErr)
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3CBBB1]"></div>
      </div>
    )
  }

  if (error && !link) {
    return (
      <div className="max-w-md mx-auto mt-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            Registration Error
          </h2>
          <p className="text-red-700">{error}</p>
          {token && (
            <p className="text-red-600 text-sm mt-2">
              Token: {token.substring(0, 20)}...
            </p>
          )}
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-8 px-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-green-800 mb-2">
            Registration Successful! 🎉
          </h2>
          <p className="text-green-700 mb-4">
            You've been added to {link?.pools?.name || 'the pool'}.
          </p>
          {magicLinkSent ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 font-medium">Check your email!</p>
              <p className="text-[#35a8a0] text-sm mt-1">
                We sent a magic link to <strong>{formData.email}</strong> to log you in.
              </p>
            </div>
          ) : (
            <p className="text-gray-600 text-sm">
              You can now <a href="/login" className="text-[#3CBBB1] underline">log in</a> with your email.
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!link) {
    // This shouldn't happen, but handle it gracefully
    return (
      <div className="max-w-md mx-auto mt-8 px-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            Unable to Load Registration
          </h2>
          <p className="text-yellow-700">
            Please check your registration link and try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-8 px-4">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Join {link?.pools?.name || 'this pool'}
        </h1>
        <p className="text-gray-600 text-sm mb-6">
          Fill out the form below to register for this pickleball pool.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label
              htmlFor="venmo_account"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Venmo Account <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                type="text"
                id="venmo_account"
                required
                value={formData.venmo_account}
                onChange={(e) =>
                  setFormData({ ...formData, venmo_account: e.target.value.replace('@', '') })
                }
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
                placeholder="your-venmo-username"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Email Notifications
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notification_preferences?.email || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      notification_preferences: {
                        email: e.target.checked,
                        sms: false, // SMS is always off during registration
                      },
                    })
                  }
                  className="mr-2 h-4 w-4 text-[#3CBBB1] focus:ring-[#3CBBB1] border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  Receive email notifications for sessions and payments
                </span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              You can enable SMS notifications later in your{' '}
              <a href="/settings" className="text-[#3CBBB1] hover:underline">
                account settings
              </a>
              . View our{' '}
              <a href="/terms" target="_blank" className="text-[#3CBBB1] hover:underline">
                Terms & Privacy Policy
              </a>
              .
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#3CBBB1] text-white py-2 px-4 rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  )
}

