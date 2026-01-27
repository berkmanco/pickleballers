import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPool, isPoolOwner, Pool } from '../lib/pools'
import { createSession, CreateSessionData, getSession, updateSession } from '../lib/sessions'
import { notifySessionCreated } from '../lib/notifications'
import { checkCourtAvailability, calculateEndTime, AvailableCourt } from '../lib/courtreserve'

/**
 * Calculate CourtReserve pricing based on duration (doubles rate)
 * 
 * Pricing structure:
 * - 30 min: $4.50 admin + $24 guest pool
 * - 60 min: $9.00 admin + $48 guest pool
 * - 90 min: $13.50 admin + $72 guest pool
 * - 120 min: $18.00 admin + $96 guest pool
 * 
 * Formula: Rate per minute × duration
 * - Admin: $0.15/min
 * - Guest pool: $0.80/min (3 guests × $0.2667/min each)
 */
function calculateCourtReservePricing(durationMinutes: number) {
  return {
    admin_cost_per_court: durationMinutes * 0.15,
    guest_pool_per_court: durationMinutes * 0.80,
  }
}

export default function CreateSession() {
  const [searchParams] = useSearchParams()
  const { id: sessionId } = useParams<{ id: string }>()
  const poolId = searchParams.get('pool')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [pool, setPool] = useState<Pool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const isEditMode = !!sessionId

  // Initialize with 90 minute defaults (most common booking)
  const initialDuration = 90
  const initialPricing = calculateCourtReservePricing(initialDuration)
  
  const [formData, setFormData] = useState<CreateSessionData>({
    pool_id: poolId || '',
    proposed_date: '',
    proposed_time: '',
    duration_minutes: initialDuration,
    min_players: 4,
    max_players: 6,
    court_location: 'Pickle Shack',
    court_numbers: [],
    courts_needed: 1,
    admin_cost_per_court: initialPricing.admin_cost_per_court,
    guest_pool_per_court: initialPricing.guest_pool_per_court,
  })
  const [courtNumbersInput, setCourtNumbersInput] = useState('')
  
  // Court availability state
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availabilityResult, setAvailabilityResult] = useState<{
    isAvailable: boolean
    availableCourts: AvailableCourt[]
    message: string
  } | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const currentUserId = user.id

    async function loadData() {
      try {
        setLoading(true)
        
        // If editing, load the session first
        if (sessionId) {
          const sessionData = await getSession(sessionId)
          
          // Check ownership
          const owner = await isPoolOwner(sessionData.pool_id, currentUserId)
          setIsOwner(owner)
          
          if (!owner) {
            setError('You must be the pool owner to edit sessions')
            return
          }
          
          if (sessionData.roster_locked) {
            setError('Cannot edit a session with a locked roster')
            return
          }
          
          // Load pool data
          const poolData = await getPool(sessionData.pool_id)
          setPool(poolData)
          
          // Populate form with existing session data
          setFormData({
            pool_id: sessionData.pool_id,
            proposed_date: sessionData.proposed_date,
            proposed_time: sessionData.proposed_time,
            duration_minutes: sessionData.duration_minutes,
            min_players: sessionData.min_players,
            max_players: sessionData.max_players,
            court_location: sessionData.court_location || '',
            court_numbers: sessionData.court_numbers || [],
            courts_needed: sessionData.courts_needed,
            admin_cost_per_court: sessionData.admin_cost_per_court,
            guest_pool_per_court: sessionData.guest_pool_per_court,
          })
          setCourtNumbersInput(sessionData.court_numbers?.join(', ') || '')
        } else if (poolId) {
          // Creating new session
          const poolData = await getPool(poolId)
          setPool(poolData)
          setFormData((prev) => ({ ...prev, pool_id: poolData.id }))

          const owner = await isPoolOwner(poolData.id, currentUserId)
          setIsOwner(owner)

          if (!owner) {
            setError('You must be the pool owner to create sessions')
          }
        } else {
          setError('No pool or session specified')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [sessionId, poolId, user])

  // Check court availability at Pickle Shack
  const handleCheckAvailability = async () => {
    if (!formData.proposed_date || !formData.proposed_time) {
      setAvailabilityError('Please select a date and time first')
      return
    }

    try {
      setCheckingAvailability(true)
      setAvailabilityError(null)
      setAvailabilityResult(null)

      const endTime = calculateEndTime(formData.proposed_time, formData.duration_minutes)
      
      const result = await checkCourtAvailability(
        formData.proposed_date,
        formData.proposed_time,
        endTime,
        formData.courts_needed
      )

      if (result.requestedSlot) {
        setAvailabilityResult({
          isAvailable: result.requestedSlot.isAvailable,
          availableCourts: result.requestedSlot.availableCourts,
          message: result.requestedSlot.message,
        })

        // Auto-fill court numbers if available
        if (result.requestedSlot.isAvailable && result.requestedSlot.availableCourts.length > 0) {
          const courtNames = result.requestedSlot.availableCourts
            .slice(0, formData.courts_needed)
            .map(c => c.name.replace('Court #', ''))
            .join(', ')
          setCourtNumbersInput(courtNames)
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check availability'
      setAvailabilityError(errorMessage)
    } finally {
      setCheckingAvailability(false)
    }
  }

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
      
      if (isEditMode && sessionId) {
        // Update existing session
        await updateSession(sessionId, {
          ...formData,
          court_numbers: courtNumbers,
        })
        navigate(`/s/${sessionId}`)
      } else {
        // Create new session
        const session = await createSession({
          ...formData,
          court_numbers: courtNumbers,
        })
        
        // Notify pool members about the new session (fire and forget)
        notifySessionCreated(session.id).catch(console.error)
        
        navigate(`/s/${session.id}`)
      }
    } catch (err: any) {
      setError(err.message || (isEditMode ? 'Failed to update session' : 'Failed to create session'))
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
          to={isEditMode && sessionId ? `/s/${sessionId}` : pool ? `/p/${pool.slug}` : '/pools'}
          className="text-[#3CBBB1] hover:text-[#35a8a0] text-sm mb-4 inline-block"
        >
          ← Back to {isEditMode ? 'Session' : pool?.name || 'Pools'}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {isEditMode ? 'Edit Session' : 'Create New Session'}
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
              onChange={(e) => {
                const duration = parseInt(e.target.value)
                const pricing = calculateCourtReservePricing(duration)
                setFormData({
                  ...formData,
                  duration_minutes: duration,
                  admin_cost_per_court: pricing.admin_cost_per_court,
                  guest_pool_per_court: pricing.guest_pool_per_court,
                })
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            >
              <option value={30}>30 min ($4.50 + $24 pool)</option>
              <option value={60}>60 min ($9 + $48 pool)</option>
              <option value={90}>90 min ($13.50 + $72 pool)</option>
              <option value={120}>120 min ($18 + $96 pool)</option>
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

        <div className="grid sm:grid-cols-3 gap-4">
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
              htmlFor="courts_needed"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Courts Needed
            </label>
            <select
              id="courts_needed"
              value={formData.courts_needed}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  courts_needed: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            >
              <option value={1}>1 court</option>
              <option value={2}>2 courts</option>
              <option value={3}>3 courts</option>
              <option value={4}>4 courts</option>
            </select>
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
              placeholder="e.g., 1, 2"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
            />
          </div>
        </div>

        {/* Court Availability Check - only show for Pickle Shack */}
        {formData.court_location.toLowerCase().includes('pickle') && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                🏓 Check Pickle Shack Availability
              </h3>
              <button
                type="button"
                onClick={handleCheckAvailability}
                disabled={checkingAvailability || !formData.proposed_date || !formData.proposed_time}
                className="px-3 py-1.5 text-sm bg-[#3CBBB1] text-white rounded-md hover:bg-[#35a8a0] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {checkingAvailability ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Checking...
                  </span>
                ) : (
                  'Check Availability'
                )}
              </button>
            </div>

            {availabilityError && (
              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                ⚠️ {availabilityError}
              </div>
            )}

            {availabilityResult && (
              <div className={`text-sm p-3 rounded ${
                availabilityResult.isAvailable 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
              }`}>
                <p className="font-medium mb-2">{availabilityResult.message}</p>
                {availabilityResult.availableCourts.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Available courts:</p>
                    <div className="flex flex-wrap gap-1">
                      {availabilityResult.availableCourts.map(court => (
                        <span
                          key={court.id}
                          className="px-2 py-0.5 bg-white rounded text-xs border"
                        >
                          {court.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!availabilityResult && !availabilityError && !checkingAvailability && (
              <p className="text-xs text-gray-500">
                Select a date and time above, then click "Check Availability" to see which courts are open.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(isEditMode && sessionId ? `/s/${sessionId}` : pool ? `/p/${pool.slug}` : '/pools')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#3CBBB1]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-[#3CBBB1] text-white py-2 px-4 rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Session')}
          </button>
        </div>
      </form>
    </div>
  )
}

