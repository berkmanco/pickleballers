import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getSession, SessionWithPool, getSessionCostSummary, SessionCostSummary, lockRoster } from '../lib/sessions'
import { isPoolOwner, getCurrentPlayerId, getPoolOwnerPlayer } from '../lib/pools'
import {
  getSessionParticipants,
  optInToSession,
  optOutOfSession,
  getCurrentPlayerStatus,
  SessionParticipantWithPlayer,
  ParticipantStatus,
} from '../lib/sessionParticipants'
import {
  getSessionPayments,
  createPaymentsForSession,
  markPaymentPaid,
  forgivePayment,
  markRequestSent,
  getPaymentSummary,
  PaymentWithParticipant,
  PaymentSummary,
} from '../lib/payments'
import { notifyRosterLocked, notifyPaymentReminder } from '../lib/notifications'

export default function SessionDetails() {
  const { id } = useParams<{ id: string }>()
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
  
  // Payment state
  const [payments, setPayments] = useState<PaymentWithParticipant[]>([])
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null)
  const [lockingRoster, setLockingRoster] = useState(false)
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null)

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

        // Load payments if roster is locked
        if (sessionData.roster_locked) {
          await loadPayments(sessionData.id)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load session')
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [id, user])

  async function loadPayments(sessionId: string) {
    try {
      const [paymentsData, summaryData] = await Promise.all([
        getSessionPayments(sessionId),
        getPaymentSummary(sessionId),
      ])
      setPayments(paymentsData)
      setPaymentSummary(summaryData)
    } catch (err) {
      console.error('Failed to load payments:', err)
    }
  }

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

  async function handleLockRoster() {
    if (!session || lockingRoster) return

    // Confirm with the user
    const committedCount = participants.filter(p => p.status === 'committed' || p.status === 'paid').length
    if (committedCount < session.min_players) {
      setError(`Cannot lock roster: only ${committedCount} players committed, need at least ${session.min_players}`)
      return
    }

    if (!confirm(`Lock roster with ${committedCount} players and generate payment requests?`)) {
      return
    }

    try {
      setLockingRoster(true)
      setError(null)

      // Get admin's Venmo account for payment links
      const adminPlayer = await getPoolOwnerPlayer(session.pool_id)
      if (!adminPlayer?.venmo_account) {
        setError('Admin Venmo account not set. Please update your profile.')
        return
      }

      // Lock the roster
      const updatedSession = await lockRoster(session.id)
      setSession({ ...session, ...updatedSession })

      // Create payment records
      await createPaymentsForSession(
        session.id,
        adminPlayer.venmo_account,
        session.proposed_date,
        session.proposed_time,
        session.pools.name
      )

      // Reload payments
      await loadPayments(session.id)

      // Send notification emails to guests
      try {
        const result = await notifyRosterLocked(session.id)
        if (result.success) {
          setNotificationStatus(`✓ Payment emails sent to ${result.sent} guest(s)`)
        } else {
          setNotificationStatus(`⚠️ Some emails failed to send: ${result.error}`)
        }
      } catch (notifyErr) {
        console.error('Failed to send notifications:', notifyErr)
        // Don't fail the whole operation, just log it
      }
    } catch (err: any) {
      setError(err.message || 'Failed to lock roster')
    } finally {
      setLockingRoster(false)
    }
  }

  async function handleSendReminder() {
    if (!session || sendingReminder) return

    if (!confirm('Send a payment reminder to all guests with pending payments?')) {
      return
    }

    try {
      setSendingReminder(true)
      setNotificationStatus(null)
      
      const result = await notifyPaymentReminder(session.id)
      
      if (result.success) {
        setNotificationStatus(`✓ Reminder sent to ${result.sent} guest(s)`)
      } else {
        setNotificationStatus(`⚠️ Failed to send reminders: ${result.error}`)
      }
    } catch (err: any) {
      setNotificationStatus(`⚠️ Failed to send reminders: ${err.message}`)
    } finally {
      setSendingReminder(false)
    }
  }

  async function handleMarkPaid(paymentId: string) {
    if (updatingPayment) return

    try {
      setUpdatingPayment(paymentId)
      await markPaymentPaid(paymentId)
      if (session) {
        await loadPayments(session.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to mark payment as paid')
    } finally {
      setUpdatingPayment(null)
    }
  }

  async function handleForgivePayment(paymentId: string, playerName: string) {
    if (updatingPayment) return

    if (!confirm(`Forgive payment for ${playerName}? They won't owe anything.`)) {
      return
    }
    
    try {
      setUpdatingPayment(paymentId)
      await forgivePayment(paymentId)
      if (session) {
        await loadPayments(session.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to forgive payment')
    } finally {
      setUpdatingPayment(null)
    }
  }

  async function handleMarkRequestSent(paymentId: string) {
    if (updatingPayment) return

    try {
      setUpdatingPayment(paymentId)
      await markRequestSent(paymentId)
      if (session) {
        await loadPayments(session.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to mark request as sent')
    } finally {
      setUpdatingPayment(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3CBBB1]"></div>
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
            to="/dashboard"
            className="text-[#3CBBB1] hover:text-[#35a8a0] mt-4 inline-block"
          >
            ← Back to Dashboard
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
          className="text-[#3CBBB1] hover:text-[#35a8a0] text-sm mb-4 inline-block"
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
                className="w-full bg-[#3CBBB1] text-white py-2 px-4 rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#3CBBB1]"></div>
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

      {/* Admin Actions - Lock Roster */}
      {isOwner && !session.roster_locked && !isPast && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h2>
          <p className="text-sm text-gray-600 mb-4">
            Locking the roster will confirm the session and generate payment requests for all guests.
            The cost per guest will be fixed based on the current headcount.
          </p>
          <button
            onClick={handleLockRoster}
            disabled={lockingRoster || (costSummary?.total_players || 0) < session.min_players}
            className="w-full sm:w-auto bg-[#3CBBB1] text-white py-2 px-6 rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {lockingRoster ? 'Locking Roster...' : '🔒 Lock Roster & Generate Payments'}
          </button>
          {(costSummary?.total_players || 0) < session.min_players && (
            <p className="text-sm text-yellow-600 mt-2">
              Cannot lock roster until minimum players ({session.min_players}) are committed.
            </p>
          )}
        </div>
      )}

      {/* Roster Locked Badge */}
      {session.roster_locked && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-blue-600">🔒</span>
            <span className="font-medium text-blue-800">Roster Locked</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            The participant list and cost per guest are now fixed.
          </p>
        </div>
      )}

      {/* Payments Section (Admin Only, when roster locked) */}
      {isOwner && session.roster_locked && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
            <div className="flex items-center gap-4">
              {paymentSummary && paymentSummary.pending_count > 0 && (
                <button
                  onClick={handleSendReminder}
                  disabled={sendingReminder}
                  className="text-sm bg-yellow-500 text-white px-3 py-1.5 rounded hover:bg-yellow-600 disabled:opacity-50 transition font-medium"
                >
                  {sendingReminder ? 'Sending...' : '📧 Send Reminder'}
                </button>
              )}
              {paymentSummary && (
                <div className="text-sm text-gray-600">
                  <span className="text-green-600 font-medium">${paymentSummary.total_paid.toFixed(2)}</span>
                  <span className="mx-1">collected</span>
                  {paymentSummary.pending_count > 0 ? (
                    <span className="ml-2 text-yellow-600">
                      ({paymentSummary.pending_count} pending)
                    </span>
                  ) : (
                    <span className="ml-2 text-green-600">✓ All resolved</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notification Status */}
          {notificationStatus && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              notificationStatus.startsWith('✓') 
                ? 'bg-green-50 text-green-700'
                : 'bg-yellow-50 text-yellow-700'
            }`}>
              {notificationStatus}
            </div>
          )}

          {/* Payment Progress Bar */}
          {paymentSummary && paymentSummary.payments_count > 0 && (
            <div className="mb-6">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                {/* Paid portion (green) */}
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{
                    width: `${(paymentSummary.total_paid / paymentSummary.total_owed) * 100}%`,
                  }}
                />
                {/* Forgiven portion (gray) */}
                <div
                  className="h-full bg-gray-400 transition-all duration-300"
                  style={{
                    width: `${(paymentSummary.total_forgiven / paymentSummary.total_owed) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Payments List */}
          {payments.length === 0 ? (
            <p className="text-gray-500 text-sm">No payments to track (admin plays free).</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className={`p-4 rounded-lg border ${
                    payment.status === 'paid'
                      ? 'bg-green-50 border-green-200'
                      : payment.status === 'forgiven'
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {payment.session_participants.players.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            payment.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'forgiven'
                              ? 'bg-gray-100 text-gray-600'
                              : payment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        <span className="font-medium">${payment.amount.toFixed(2)}</span>
                        {payment.session_participants.players.venmo_account && (
                          <span className="ml-2 text-gray-400">
                            @{payment.session_participants.players.venmo_account.replace('@', '')}
                          </span>
                        )}
                      </div>
                      {payment.venmo_request_sent_at && payment.status === 'pending' && (
                        <p className="mt-1 text-xs text-blue-600">
                          📤 Request sent {new Date(payment.venmo_request_sent_at).toLocaleDateString()}
                        </p>
                      )}
                      {payment.notes && (
                        <p className="mt-1 text-xs text-gray-500 italic">{payment.notes}</p>
                      )}
                    </div>

                    {/* Payment Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {payment.status === 'pending' && (
                        <>
                          {/* Venmo Link - Most Prominent */}
                          {payment.venmo_payment_link && (
                            <a
                              href={payment.venmo_payment_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                if (!payment.venmo_request_sent_at) {
                                  handleMarkRequestSent(payment.id)
                                }
                              }}
                              className="text-sm bg-[#008CFF] text-white px-3 py-1.5 rounded hover:bg-[#0074D4] transition font-medium flex items-center gap-1"
                            >
                              <span>💸</span> Request
                            </a>
                          )}
                          <button
                            onClick={() => handleMarkPaid(payment.id)}
                            disabled={updatingPayment === payment.id}
                            className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50 transition"
                          >
                            {updatingPayment === payment.id ? '...' : '✓ Paid'}
                          </button>
                          <button
                            onClick={() => handleForgivePayment(payment.id, payment.session_participants.players.name)}
                            disabled={updatingPayment === payment.id}
                            className="text-sm text-gray-500 hover:text-gray-700 px-2 disabled:opacity-50 transition"
                            title="Forgive payment"
                          >
                            Forgive
                          </button>
                        </>
                      )}
                      {payment.status === 'paid' && payment.payment_date && (
                        <span className="text-xs text-gray-500">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </span>
                      )}
                      {payment.status === 'forgiven' && (
                        <span className="text-xs text-gray-500">Forgiven</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

