import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getSession, SessionWithPool, getSessionCostSummary, SessionCostSummary, lockRoster, unlockRoster, deleteSession, cancelSession, updateCourtsNeeded } from '../lib/sessions'
import { isPoolOwner, getCurrentPlayerId } from '../lib/pools'
import {
  getSessionParticipants,
  optInToSession,
  optOutOfSession,
  getCurrentPlayerStatus,
  getPoolPlayersNotInSession,
  addPlayerToSession,
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
import { notifyRosterLocked, notifyPaymentReminder, notifySessionReminder } from '../lib/notifications'
import { generateGoogleCalendarUrl, downloadIcsFile, createSessionCalendarEvent } from '../lib/calendar'
import { getSessionComments, addSessionComment, deleteSessionComment, Comment } from '../lib/comments'

export default function SessionDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
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
  const [sendingSessionReminder, setSendingSessionReminder] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null)
  
  // Session management state
  const [unlockingRoster, setUnlockingRoster] = useState(false)
  const [deletingSession, setDeletingSession] = useState(false)
  
  // Add player state
  const [availablePlayers, setAvailablePlayers] = useState<{ id: string; name: string }[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  
  // Court adjustment state
  const [editingCourts, setEditingCourts] = useState(false)
  const [adjustedCourts, setAdjustedCourts] = useState<number>(1)
  const [updatingCourts, setUpdatingCourts] = useState(false)
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)

  useEffect(() => {
    if (!id || !user) return
    const sessionId = id // Capture for TypeScript narrowing in async function
    const userId = user.id

    async function loadSession() {
      try {
        setLoading(true)
        
        // Phase 1: Load session and player ID in parallel (independent)
        const [sessionData, playerId] = await Promise.all([
          getSession(sessionId),
          getCurrentPlayerId(userId),
        ])
        
        setSession(sessionData)
        setCurrentPlayerId(playerId)
        setAdjustedCourts(sessionData.courts_needed)

        // Phase 2: Now that we have session, load dependent data in parallel
        const [owner, participantsData, costSummaryData] = await Promise.all([
          isPoolOwner(sessionData.pool_id, userId),
          getSessionParticipants(sessionData.id),
          getSessionCostSummary(sessionData.id).catch(() => null),
        ])
        
        setIsOwner(owner)
        setParticipants(participantsData)
        setCostSummary(costSummaryData)
        setLoadingParticipants(false)
        
        // Set current player status from participants
        if (playerId) {
          const myParticipation = participantsData.find(p => p.player_id === playerId)
          setCurrentPlayerStatus(myParticipation?.status || null)
        }

        // Phase 3: Owner-only and roster-locked data in parallel
        const phase3Promises: Promise<any>[] = []
        
        if (owner) {
          phase3Promises.push(
            getPoolPlayersNotInSession(sessionData.pool_id, sessionData.id)
              .then(players => setAvailablePlayers(players))
          )
        }
        
        if (sessionData.roster_locked) {
          phase3Promises.push(loadPayments(sessionData.id))
        }
        
        // Always load comments (pool members can comment anytime)
        phase3Promises.push(loadComments(sessionData.id))
        
        if (phase3Promises.length > 0) {
          await Promise.all(phase3Promises)
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

  async function loadComments(sessionId: string) {
    try {
      setLoadingComments(true)
      const commentsData = await getSessionComments(sessionId)
      setComments(commentsData)
    } catch (err) {
      console.error('Failed to load comments:', err)
    } finally {
      setLoadingComments(false)
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

  async function loadAvailablePlayers() {
    if (!session) return
    try {
      const players = await getPoolPlayersNotInSession(session.pool_id, session.id)
      setAvailablePlayers(players)
      setSelectedPlayerId('')
    } catch (err) {
      console.error('Failed to load available players:', err)
    }
  }

  async function handleAddPlayer() {
    if (!session || !selectedPlayerId || addingPlayer) return

    try {
      setAddingPlayer(true)
      setError(null)
      await addPlayerToSession(session.id, selectedPlayerId, 'committed')
      
      // Reload participants and available players
      if (currentPlayerId) {
        await loadParticipants(session.id, currentPlayerId)
      }
      await loadAvailablePlayers()
      
      // Reload cost summary
      const summary = await getSessionCostSummary(session.id)
      setCostSummary(summary)
    } catch (err: any) {
      setError(err.message || 'Failed to add player')
    } finally {
      setAddingPlayer(false)
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

      // Lock the roster
      const updatedSession = await lockRoster(session.id)
      setSession({ ...session, ...updatedSession })

      // Create payment records (links use each guest's Venmo for request)
      await createPaymentsForSession(
        session.id,
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

  async function handleSendSessionReminder() {
    if (!session || sendingSessionReminder) return

    if (!confirm('Send a session reminder to all committed players? This will remind them about the time and location.')) {
      return
    }

    try {
      setSendingSessionReminder(true)
      setNotificationStatus(null)
      
      const result = await notifySessionReminder(session.id)
      
      if (result.success) {
        setNotificationStatus(`✓ Session reminder sent to ${result.sent} player(s)`)
      } else {
        setNotificationStatus(`⚠️ Failed to send reminders: ${result.error}`)
      }
    } catch (err: any) {
      setNotificationStatus(`⚠️ Failed to send reminders: ${err.message}`)
    } finally {
      setSendingSessionReminder(false)
    }
  }

  async function handleUnlockRoster() {
    if (!session || unlockingRoster) return

    const hasPayments = payments.length > 0
    const message = hasPayments
      ? 'Unlock the roster? This will delete all existing payments and reset the session to "proposed" status. Players will need to be re-billed when you lock again.'
      : 'Unlock the roster? This will reset the session to "proposed" status.'

    if (!confirm(message)) {
      return
    }

    try {
      setUnlockingRoster(true)
      setError(null)

      const updatedSession = await unlockRoster(session.id, hasPayments)
      setSession({ ...session, ...updatedSession })
      setPayments([])
      setPaymentSummary(null)
      setNotificationStatus('✓ Roster unlocked. Session is now open for changes.')
    } catch (err: any) {
      setError(err.message || 'Failed to unlock roster')
    } finally {
      setUnlockingRoster(false)
    }
  }

  async function handleDeleteSession() {
    if (!session || deletingSession) return

    const message = session.roster_locked
      ? '⚠️ WARNING: This session has a locked roster with payments. Deleting will permanently remove all payment records. Are you sure?'
      : 'Delete this session? This action cannot be undone.'

    if (!confirm(message)) {
      return
    }

    // Double confirm for locked sessions
    if (session.roster_locked) {
      if (!confirm('This is your last chance. Really delete this session and all its data?')) {
        return
      }
    }

    try {
      setDeletingSession(true)
      setError(null)

      await deleteSession(session.id)
      
      // Navigate back to pool
      navigate(`/p/${session.pools.slug}`)
    } catch (err: any) {
      setError(err.message || 'Failed to delete session')
      setDeletingSession(false)
    }
  }

  async function handleCancelSession() {
    if (!session) return

    if (!confirm('Cancel this session? Participants will be notified.')) {
      return
    }

    try {
      setError(null)
      const updatedSession = await cancelSession(session.id)
      setSession({ ...session, ...updatedSession })
    } catch (err: any) {
      setError(err.message || 'Failed to cancel session')
    }
  }

  async function handleUpdateCourts() {
    if (!session || updatingCourts) return

    try {
      setUpdatingCourts(true)
      setError(null)
      const updatedSession = await updateCourtsNeeded(session.id, adjustedCourts)
      setSession({ ...session, ...updatedSession })
      // Reload cost summary with new court count
      const newCostSummary = await getSessionCostSummary(session.id)
      setCostSummary(newCostSummary)
      setEditingCourts(false)
    } catch (err: any) {
      setError(err.message || 'Failed to update courts')
    } finally {
      setUpdatingCourts(false)
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

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !newComment.trim() || addingComment) return

    try {
      setAddingComment(true)
      await addSessionComment(session.id, newComment)
      setNewComment('')
      // Reload comments to show the new one
      await loadComments(session.id)
    } catch (err: any) {
      setError(err.message || 'Failed to add comment')
    } finally {
      setAddingComment(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!session) return
    if (!confirm('Delete this comment?')) return

    try {
      await deleteSessionComment(commentId)
      // Reload comments
      await loadComments(session.id)
    } catch (err: any) {
      setError(err.message || 'Failed to delete comment')
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

  // Append T00:00:00 to force local timezone interpretation (not UTC)
  const sessionDate = new Date(`${session.proposed_date}T00:00:00`)
  const sessionDateTime = new Date(
    `${session.proposed_date}T${session.proposed_time}`
  )
  const isPast = sessionDateTime < new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isToday = sessionDate.getTime() === today.getTime()

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
            {session.court_numbers && session.court_numbers.length > 0 && (
              <div>
                <dt className="text-gray-500">Courts</dt>
                <dd className="text-gray-900 mt-1">
                  {session.court_numbers.length === 1 
                    ? `Court ${session.court_numbers[0]}`
                    : `Courts ${session.court_numbers.join(', ')}`}
                </dd>
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
          
          {/* Add to Calendar */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Add to your calendar</p>
            <div className="flex gap-2">
              <a
                href={generateGoogleCalendarUrl(createSessionCalendarEvent(
                  session.pools.name,
                  session.court_location || 'Location TBD',
                  session.court_numbers,
                  session.proposed_date,
                  session.proposed_time,
                  session.duration_minutes,
                  `${window.location.origin}/s/${session.id}`
                ))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition text-gray-700"
              >
                <span>📅</span> Google
              </a>
              <button
                onClick={() => downloadIcsFile(
                  createSessionCalendarEvent(
                    session.pools.name,
                    session.court_location || 'Location TBD',
                    session.court_numbers,
                    session.proposed_date,
                    session.proposed_time,
                    session.duration_minutes,
                    `${window.location.origin}/s/${session.id}`
                  ),
                  `dinkup-${session.proposed_date}.ics`
                )}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition text-gray-700"
              >
                <span>📥</span> iCal/Outlook
              </button>
            </div>
          </div>
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

          {/* Admin: Add player to session */}
          {isOwner && !session.roster_locked && !isPast && session.status !== 'cancelled' && availablePlayers.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Add Player to Session
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
                >
                  <option value="">Select a player...</option>
                  {availablePlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddPlayer}
                  disabled={!selectedPlayerId || addingPlayer}
                  className="px-4 py-2 text-sm bg-[#3CBBB1] text-white rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {addingPlayer ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}

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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h2>
        {costSummary ? (
          <>
            {/* Main stats */}
            <dl className="grid sm:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <dt className="text-gray-500">Committed Players</dt>
                <dd className="text-gray-900 mt-1 font-medium">
                  {costSummary.total_players} ({costSummary.guest_count} guests)
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Courts Reserved</dt>
                <dd className="text-gray-900 mt-1 flex items-center gap-2">
                  {!session.roster_locked && isOwner && !editingCourts ? (
                    <>
                      <span>{session.courts_needed}</span>
                      <button
                        onClick={() => setEditingCourts(true)}
                        className="text-xs text-[#3CBBB1] hover:text-[#35a8a0]"
                      >
                        (adjust)
                      </button>
                    </>
                  ) : editingCourts ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={adjustedCourts}
                        onChange={(e) => setAdjustedCourts(parseInt(e.target.value))}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleUpdateCourts}
                        disabled={updatingCourts}
                        className="text-xs bg-[#3CBBB1] text-white px-2 py-1 rounded hover:bg-[#35a8a0] disabled:opacity-50"
                      >
                        {updatingCourts ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setAdjustedCourts(session.courts_needed)
                          setEditingCourts(false)
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span>{session.courts_needed}</span>
                  )}
                </dd>
              </div>
            </dl>

            {/* Cost calculation breakdown */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">How cost is calculated:</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="text-gray-500">Guest pool per court:</span>{' '}
                  ${session.guest_pool_per_court.toFixed(2)} × {session.courts_needed} court{session.courts_needed !== 1 ? 's' : ''} = <strong>${costSummary.guest_pool?.toFixed(2)}</strong>
                </p>
                <p>
                  <span className="text-gray-500">Split among {costSummary.guest_count} guest{costSummary.guest_count !== 1 ? 's' : ''}:</span>{' '}
                  ${costSummary.guest_pool?.toFixed(2)} ÷ {costSummary.guest_count} = <strong className="text-lg text-gray-900">${costSummary.guest_cost?.toFixed(2)}</strong>
                </p>
                {isOwner && (
                  <p className="text-gray-400 text-xs mt-2">
                    Admin covers: ${session.admin_cost_per_court.toFixed(2)} × {session.courts_needed} = ${costSummary.admin_cost?.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Warnings */}
            {costSummary.total_players < session.min_players && (
              <p className="text-yellow-600 text-sm">
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
      {isOwner && !session.roster_locked && !isPast && session.status !== 'cancelled' && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h2>
          <p className="text-sm text-gray-600 mb-4">
            Locking the roster will confirm the session and generate payment requests for all guests.
            The cost per guest will be fixed based on the current headcount.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/s/${session.id}/edit`}
              className="bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition font-medium"
            >
              ✏️ Edit Session
            </Link>
            <button
              onClick={handleLockRoster}
              disabled={lockingRoster || (costSummary?.total_players || 0) < session.min_players}
              className="bg-[#3CBBB1] text-white py-2 px-6 rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {lockingRoster ? 'Locking Roster...' : '🔒 Lock Roster & Generate Payments'}
            </button>
            <button
              onClick={handleSendSessionReminder}
              disabled={sendingSessionReminder || participants.filter(p => p.status === 'committed' || p.status === 'paid').length === 0}
              className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {sendingSessionReminder ? 'Sending...' : '📣 Send Reminder'}
            </button>
            <button
              onClick={handleCancelSession}
              className="bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition"
            >
              Cancel Session
            </button>
            <button
              onClick={handleDeleteSession}
              disabled={deletingSession}
              className="text-red-600 hover:text-red-700 py-2 px-4 transition"
            >
              {deletingSession ? 'Deleting...' : 'Delete'}
            </button>
          </div>
          {(costSummary?.total_players || 0) < session.min_players && (
            <p className="text-sm text-yellow-600 mt-2">
              Cannot lock roster until minimum players ({session.min_players}) are committed.
            </p>
          )}
        </div>
      )}

      {/* Cancelled Session Banner */}
      {session.status === 'cancelled' && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-red-600">❌</span>
                <span className="font-medium text-red-800">Session Cancelled</span>
              </div>
              <p className="text-sm text-red-700 mt-1">
                This session has been cancelled.
              </p>
            </div>
            {isOwner && (
              <button
                onClick={handleDeleteSession}
                disabled={deletingSession}
                className="text-sm bg-red-100 border border-red-300 text-red-700 px-3 py-1.5 rounded hover:bg-red-200 disabled:opacity-50 transition"
              >
                {deletingSession ? 'Deleting...' : '🗑️ Delete Session'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Roster Locked Badge */}
      {session.roster_locked && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600">🔒</span>
                <span className="font-medium text-blue-800">Roster Locked</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                The participant list and cost per guest are now fixed.
              </p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-2">
                {!isPast && (
                  <button
                    onClick={handleSendSessionReminder}
                    disabled={sendingSessionReminder}
                    className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 disabled:opacity-50 transition"
                  >
                    {sendingSessionReminder ? 'Sending...' : '📣 Remind'}
                  </button>
                )}
                <button
                  onClick={handleUnlockRoster}
                  disabled={unlockingRoster}
                  className="text-sm bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100 disabled:opacity-50 transition"
                >
                  {unlockingRoster ? 'Unlocking...' : '🔓 Unlock'}
                </button>
                <button
                  onClick={handleDeleteSession}
                  disabled={deletingSession}
                  className="text-sm text-red-600 hover:text-red-700 px-2 py-1.5 transition"
                >
                  {deletingSession ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            )}
          </div>
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

      {/* Comments Section */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Comments
        </h2>

        {/* Comment Form */}
        <form onSubmit={handleAddComment} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment for coordination..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent resize-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={!newComment.trim() || addingComment}
              className="bg-[#3CBBB1] text-white px-4 py-2 text-sm rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {addingComment ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>

        {/* Comments List */}
        {loadingComments ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3CBBB1]"></div>
          </div>
        ) : comments.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => {
              const isMyComment = comment.player?.user_id === user?.id
              const commentDate = new Date(comment.created_at)
              const timeAgo = getTimeAgo(commentDate)

              return (
                <div key={comment.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {comment.player?.name || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-400">{timeAgo}</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap break-words">
                        {comment.comment}
                      </p>
                    </div>
                    {isMyComment && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline flex-shrink-0"
                        title="Delete comment"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to format relative time
function getTimeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  
  return date.toLocaleDateString()
}

