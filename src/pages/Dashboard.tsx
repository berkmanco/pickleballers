import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { getPools, Pool, getCurrentPlayerId } from '../lib/pools'
import { getUserCommittedSessions, getOpenSessionsToJoin, UserSession, SessionWithPool } from '../lib/sessions'
import { getUserPendingPayments, UserPendingPayment, generateVenmoPayLink } from '../lib/payments'

export default function Dashboard() {
  const { user } = useAuth()
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  
  // Action items
  const [committedSessions, setCommittedSessions] = useState<UserSession[]>([])
  const [openSessions, setOpenSessions] = useState<SessionWithPool[]>([])
  const [pendingPayments, setPendingPayments] = useState<UserPendingPayment[]>([])

  useEffect(() => {
    if (!user?.id) return

    const userId = user.id
    const userEmail = user.email

    async function loadDashboard() {
      try {
        // Load pools and player ID in parallel (independent)
        const [poolsData, playerId] = await Promise.all([
          getPools(userId, userEmail || undefined),
          getCurrentPlayerId(userId, userEmail || undefined),
        ])
        setPools(poolsData)
        
        if (playerId) {
          // Load action items in parallel
          const [committed, open, payments] = await Promise.all([
            getUserCommittedSessions(playerId),
            getOpenSessionsToJoin(playerId),
            getUserPendingPayments(playerId),
          ])
          setCommittedSessions(committed)
          setOpenSessions(open)
          setPendingPayments(payments)
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Helper to format session date/time
  const formatSessionDateTime = (date: string, time: string) => {
    // Append T00:00:00 to force local timezone interpretation (not UTC)
    const sessionDate = new Date(`${date}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const isToday = sessionDate.getTime() === today.getTime()
    const isTomorrow = sessionDate.getTime() === tomorrow.getTime()
    
    const dayStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const timeStr = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    
    return `${dayStr} @ ${timeStr}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3CBBB1]"></div>
      </div>
    )
  }

  const hasActions = committedSessions.length > 0 || openSessions.length > 0 || pendingPayments.length > 0

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* Action Items Section */}
      {hasActions && (
        <div className="mb-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Your Upcoming Sessions */}
            {committedSessions.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  📅 Your Sessions
                </h3>
                <div className="space-y-2">
                  {committedSessions.slice(0, 3).map((session) => (
                    <Link
                      key={session.id}
                      to={`/s/${session.id}`}
                      className="block p-2 -mx-2 rounded hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 text-sm">
                          {formatSessionDateTime(session.proposed_date, session.proposed_time)}
                        </div>
                        {session.participant_status === 'paid' && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            Paid
                          </span>
                        )}
                        {session.is_admin && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            Host
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{session.pools.name}</div>
                    </Link>
                  ))}
                  {committedSessions.length > 3 && (
                    <p className="text-xs text-gray-400 pt-1">
                      +{committedSessions.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Sessions to Join */}
            {openSessions.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  🎾 Join a Session
                </h3>
                <div className="space-y-2">
                  {openSessions.slice(0, 3).map((session) => (
                    <Link
                      key={session.id}
                      to={`/s/${session.id}`}
                      className="block p-2 -mx-2 rounded hover:bg-gray-50 transition"
                    >
                      <div className="font-medium text-gray-900 text-sm">
                        {formatSessionDateTime(session.proposed_date, session.proposed_time)}
                      </div>
                      <div className="text-xs text-gray-500">{session.pools.name}</div>
                    </Link>
                  ))}
                  {openSessions.length > 3 && (
                    <p className="text-xs text-gray-400 pt-1">
                      +{openSessions.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pending Payments */}
            {pendingPayments.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-4">
                <h3 className="text-sm font-semibold text-yellow-800 uppercase tracking-wide mb-3">
                  💸 Payments Due
                </h3>
                <div className="space-y-2">
                  {pendingPayments.slice(0, 3).map((payment) => {
                    // Generate pay link dynamically using admin's Venmo
                    const payLink = payment.adminVenmoAccount ? generateVenmoPayLink(
                      payment.adminVenmoAccount,
                      payment.amount,
                      `Pickleball - ${payment.session?.pools?.name || 'Session'} #dinkup-${payment.id}`
                    ) : null
                    
                    return (
                      <div key={payment.id} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            ${payment.amount.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">{payment.session?.pools?.name || 'Unknown'}</div>
                        </div>
                        {payLink && (
                          <a
                            href={payLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-[#008CFF] text-white px-2 py-1 rounded hover:bg-[#0074D4] transition"
                          >
                            Pay via Venmo
                          </a>
                        )}
                      </div>
                    )
                  })}
                  {pendingPayments.length > 3 && (
                    <p className="text-xs text-yellow-700 pt-1">
                      +{pendingPayments.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pools Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Your Pools</h2>
        <Link
          to="/pools/new"
          className="bg-[#3CBBB1] text-white px-4 py-2 rounded-lg hover:bg-[#35a8a0] transition text-sm"
        >
          + New Pool
        </Link>
      </div>

      {pools.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">You don't have any pools yet.</p>
          <Link
            to="/pools/new"
            className="inline-block bg-[#3CBBB1] text-white px-6 py-3 rounded-lg hover:bg-[#35a8a0] transition"
          >
            Create Your First Pool
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {pools.map((pool) => (
            <Link
              key={pool.id}
              to={`/p/${pool.slug}`}
              className="bg-white rounded-lg shadow hover:shadow-md transition p-4 sm:p-6 block"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {pool.name}
              </h3>
              {pool.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {pool.description}
                </p>
              )}
              <span className={`text-xs px-2 py-1 rounded-full ${
                pool.owner_id === user?.id 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {pool.owner_id === user?.id ? 'Owner' : 'Member'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

