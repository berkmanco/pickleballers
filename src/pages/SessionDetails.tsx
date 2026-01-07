import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getSession, SessionWithPool, getSessionCostSummary, SessionCostSummary } from '../lib/sessions'
import { isPoolOwner, getCurrentPlayerId } from '../lib/pools'
import {
  getSessionParticipants,
  optInToSession,
  optOutOfSession,
  getCurrentPlayerStatus,
  SessionParticipantWithPlayer,
  ParticipantStatus,
} from '../lib/sessionParticipants'

export default function SessionDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [session, setSession] = useState<SessionWithPool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [participants, setParticipants] = useState<SessionParticipantWithPlayer[]>([])
  const [currentPlayerStatus, setCurrentPlayerStatus] = useState<ParticipantStatus | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [loadingParticipants, setLoadingParticipants] = useState(true)
  const [optingIn, setOptingIn] = useState(false)
  const [costSummary, setCostSummary] = useState<SessionCostSummary | null>(null)

  useEffect(() => {
    if (!id || !user) return

    async function loadSession() {
      try {
        setLoading(true)
        const sessionData = await getSession(id)
        setSession(sessionData)

        const owner = await isPoolOwner(sessionData.pool_id, user.id)
        setIsOwner(owner)

        // Get current player ID
        const playerId = await getCurrentPlayerId(user.id)
        setCurrentPlayerId(playerId)

        // Load participants
        await loadParticipants(sessionData.id, playerId)

        // Load cost summary
        try {
          const summary = await getSessionCostSummary(sessionData.id)
          setCostSummary(summary)
        } catch (err) {
          console.error('Failed to load cost summary:', err)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load session')
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [id, user])

  async function loadParticipants(sessionId: string, playerId: string | null) {
    try {
      setLoadingParticipants(true)
      const parts = await getSessionParticipants(sessionId)
      setParticipants(parts)

      // Get current player's status
      if (playerId) {
        const status = await getCurrentPlayerStatus(sessionId, playerId)
        setCurrentPlayerStatus(status?.status || null)
      }
    } catch (err: any) {
      console.error('Failed to load participants:', err)
    } finally {
      setLoadingParticipants(false)
    }
  }

  async function handleOptIn(status: 'committed' | 'maybe') {
    if (!session || optingIn) return

    try {
      setOptingIn(true)
      
      // Check if session is full - if so, force to waitlist
      const committedCount = participants.filter(p => p.status === 'committed' || p.status === 'paid').length
      const finalStatus = committedCount >= session.max_players ? 'maybe' : status
      
      await optInToSession(session.id, finalStatus)
      // Reload participants and cost summary
      if (currentPlayerId) {
        await loadParticipants(session.id, currentPlayerId)
        const summary = await getSessionCostSummary(session.id)
        setCostSummary(summary)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to opt in')
    } finally {
      setOptingIn(false)
    }
  }

  async function handleOptOut() {
    if (!session || optingIn) return

    try {
      setOptingIn(true)
      await optOutOfSession(session.id)
      // Reload participants
      if (currentPlayerId) {
        await loadParticipants(session.id, currentPlayerId)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to opt out')
    } finally {
      setOptingIn(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto mt-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error || 'Session not found'}</p>
          <Link
            to="/pools"
            className="text-blue-600 hover:text-blue-700 mt-4 inline-block"
          >
            ← Back to Pools
          </Link>
        </div>
      </div>
    )
  }

  const sessionDate = new Date(session.proposed_date)
  const sessionDateTime = new Date(
    `${session.proposed_date}T${session.proposed_time}`
  )
  const isPast = sessionDateTime < new Date()
  const isToday =
    sessionDate.toDateString() === new Date().toDateString()

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      <div className="mb-6">
        <Link
          to={`/p/${session.pools.slug}`}
          className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block"
        >
          ← Back to {session.pools.name}
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {isToday
                ? 'Today'
                : sessionDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
            </h1>
            <p className="text-gray-600 mt-1">
              {new Date(`2000-01-01T${session.proposed_time}`).toLocaleTimeString(
                'en-US',
                {
                  hour: 'numeric',
                  minute: '2-digit',
                }
              )}{' '}
              • {session.duration_minutes} minutes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                session.status === 'confirmed'
                  ? 'bg-green-100 text-green-800'
                  : session.status === 'cancelled'
                  ? 'bg-red-100 text-red-800'
                  : session.status === 'completed'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </span>
            {isOwner && (
              <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
                Owner
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Session Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Session Details
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Pool</dt>
              <dd className="text-gray-900 mt-1 font-medium">
                {session.pools.name}
              </dd>
            </div>
            {session.court_location && (
              <div>
                <dt className="text-gray-500">Location</dt>
                <dd className="text-gray-900 mt-1">{session.court_location}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">Players</dt>
              <dd className="text-gray-900 mt-1">
                {session.min_players} - {session.max_players} players
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Courts Needed</dt>
              <dd className="text-gray-900 mt-1">{session.courts_needed}</dd>
            </div>
            {session.payment_deadline && (
              <div>
                <dt className="text-gray-500">Payment Deadline</dt>
                <dd className="text-gray-900 mt-1">
                  {new Date(session.payment_deadline).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Participants Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Participants
          </h2>
          
          {/* Participant count */}
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {participants.filter(p => p.status === 'committed' || p.status === 'paid').length} of {session.max_players} spots filled
            </p>
            {participants.filter(p => p.status === 'maybe').length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {participants.filter(p => p.status === 'maybe').length} on waitlist
              </p>
            )}
          </div>

          {/* Opt-in buttons (if user is a player and not already opted in) */}
          {currentPlayerId && !currentPlayerStatus && !isPast && (
            <div className="mb-4 space-y-2">
              <button
                onClick={() => handleOptIn('committed')}
                disabled={optingIn}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {optingIn ? 'Joining...' : "I'm In"}
              </button>
              <button
                onClick={() => handleOptIn('maybe')}
                disabled={optingIn}
                className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {optingIn ? 'Adding...' : 'Maybe'}
              </button>
            </div>
          )}

          {/* Current status */}
          {currentPlayerStatus && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900 mb-2">Your Status:</p>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  currentPlayerStatus === 'committed' || currentPlayerStatus === 'paid'
                    ? 'bg-green-100 text-green-800'
                    : currentPlayerStatus === 'maybe'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {currentPlayerStatus === 'committed' ? "I'm In" :
                   currentPlayerStatus === 'paid' ? 'Paid' :
                   currentPlayerStatus === 'maybe' ? 'Maybe' :
                   'Out'}
                </span>
                {!isPast && currentPlayerStatus !== 'out' && (
                  <button
                    onClick={handleOptOut}
                    disabled={optingIn}
                    className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Drop Out
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Participants list */}
          {loadingParticipants ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
          ) : participants.length === 0 ? (
            <p className="text-gray-500 text-sm">No participants yet.</p>
          ) : (
            <div className="space-y-2">
              {participants
                .filter(p => p.status === 'committed' || p.status === 'paid')
                .map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm text-gray-900">
                      {participant.players?.name || 'Unknown'}
                    </span>
                    {participant.status === 'paid' && (
                      <span className="text-xs text-green-600">Paid</span>
                    )}
                  </div>
                ))}
              {participants.filter(p => p.status === 'maybe').length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Waitlist:</p>
                  {participants
                    .filter(p => p.status === 'maybe')
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between p-2 bg-yellow-50 rounded"
                      >
                        <span className="text-sm text-gray-900">
                          {participant.players?.name || 'Unknown'}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cost Info */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost</h2>
        {costSummary ? (
          <>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <dt className="text-gray-500">Committed Players</dt>
                <dd className="text-gray-900 mt-1 font-medium">
                  {costSummary.total_players} ({costSummary.guest_count} guests)
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Courts Needed</dt>
                <dd className="text-gray-900 mt-1">{costSummary.courts_needed}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Cost per Guest</dt>
                <dd className="text-gray-900 mt-1 font-bold text-lg">
                  ${costSummary.guest_cost ? costSummary.guest_cost.toFixed(2) : '0.00'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Total Guest Pool</dt>
                <dd className="text-gray-900 mt-1">${costSummary.guest_pool ? costSummary.guest_pool.toFixed(2) : '0.00'}</dd>
              </div>
            </dl>
            {costSummary.total_players < session.min_players && (
              <p className="text-yellow-600 text-sm mt-2">
                ⚠️ Need {session.min_players - costSummary.total_players} more player(s) to meet minimum
              </p>
            )}
          </>
        ) : (
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Admin Cost per Court</dt>
              <dd className="text-gray-900 mt-1">${session.admin_cost_per_court}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Guest Pool per Court</dt>
              <dd className="text-gray-900 mt-1">${session.guest_pool_per_court}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  )
}

