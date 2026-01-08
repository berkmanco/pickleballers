import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPool, isPoolOwner, Pool } from '../lib/pools'
import { createSession, CreateSessionData } from '../lib/sessions'
import { notifySessionCreated } from '../lib/notifications'

export default function CreateSession() {
  const [searchParams] = useSearchParams()
  const poolId = searchParams.get('pool')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [pool, setPool] = useState<Pool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  const [formData, setFormData] = useState<CreateSessionData>({
    pool_id: poolId || '',
    proposed_date: '',
    proposed_time: '',
    duration_minutes: 60,
    min_players: 4,
    max_players: 7,
    court_location: '',
    court_numbers: [],
    courts_needed: 1,
    admin_cost_per_court: 9.0,
    guest_pool_per_court: 48.0,
  })
  const [courtNumbersInput, setCourtNumbersInput] = useState('')

  useEffect(() => {
    if (!poolId || !user) return

    async function loadPool() {
      try {
        setLoading(true)
        const poolData = await getPool(poolId)
        setPool(poolData)
        setFormData((prev) => ({ ...prev, pool_id: poolData.id }))

        const owner = await isPoolOwner(poolData.id, user.id)
        setIsOwner(owner)

        if (!owner) {
          setError('You must be the pool owner to create sessions')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load pool')
      } finally {
        setLoading(false)
      }
    }

    loadPool()
  }, [poolId, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pool || !isOwner) return

    try {
      setSubmitting(true)
      setError(null)
      
      // Parse court numbers from comma-separated input
      const courtNumbers = courtNumbersInput
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      
      const session = await createSession({
        ...formData,
        court_numbers: courtNumbers,
      })
      
      // Notify pool members about the new session (fire and forget)
      notifySessionCreated(session.id).catch(console.error)
      
      navigate(`/s/${session.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create session')
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

  if (error && !pool) {
    return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
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

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            Access Denied
          </h2>
          <p className="text-yellow-700">
            You must be the pool owner to create sessions.
          </p>
          {pool && (
            <Link
              to={`/p/${pool.slug}`}
              className="text-[#3CBBB1] hover:text-[#35a8a0] mt-4 inline-block"
            >
              ← Back to {pool.name}
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4">
      <div className="mb-6">
        <Link
          to={pool ? `/p/${pool.slug}` : '/pools'}
          className="text-[#3CBBB1] hover:text-[#35a8a0] text-sm mb-4 inline-block"
        >
          ← Back to {pool?.name || 'Pools'}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Create New Session
        </h1>
        {pool && (
          <p className="text-gray-600 mt-2">for {pool.name}</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="proposed_date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="proposed_date"
              required
              value={formData.proposed_date}
              onChange={(e) =>
                setFormData({ ...formData, proposed_date: e.target.value })
              }
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="proposed_time"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              id="proposed_time"
              required
              value={formData.proposed_time}
              onChange={(e) =>
                setFormData({ ...formData, proposed_time: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="duration_minutes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Duration (minutes)
            </label>
            <select
              id="duration_minutes"
              value={formData.duration_minutes}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  duration_minutes: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            >
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="min_players"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Min Players
            </label>
            <input
              type="number"
              id="min_players"
              min={4}
              value={formData.min_players}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  min_players: parseInt(e.target.value) || 4,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="max_players"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Max Players
            </label>
            <input
              type="number"
              id="max_players"
              min={formData.min_players}
              value={formData.max_players}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  max_players: parseInt(e.target.value) || 7,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="court_location"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location
            </label>
            <input
              type="text"
              id="court_location"
              value={formData.court_location}
              onChange={(e) =>
                setFormData({ ...formData, court_location: e.target.value })
              }
              placeholder="e.g., Pickle Shack"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            />
          </div>
          <div>
            <label
              htmlFor="court_numbers"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Court Numbers
            </label>
            <input
              type="text"
              id="court_numbers"
              value={courtNumbersInput}
              onChange={(e) => setCourtNumbersInput(e.target.value)}
              placeholder="e.g., 1, 2 or A, B"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(pool ? `/p/${pool.slug}` : '/pools')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-[#3CBBB1] text-white py-2 px-4 rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </form>
    </div>
  )
}

