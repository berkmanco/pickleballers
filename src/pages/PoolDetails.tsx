import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPool, isPoolOwner, getPoolPlayers, createPlayerAndAddToPool, getPlayersNotInPool, addExistingPlayerToPool, Pool, Player } from '../lib/pools'
import { formatPhone } from '../lib/utils'
import {
  createRegistrationLink,
  getRegistrationLinks,
  RegistrationLink,
} from '../lib/registration'
import { getUpcomingSessions, Session } from '../lib/sessions'

export default function PoolDetails() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>()
  const { user } = useAuth()
  const [pool, setPool] = useState<Pool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [registrationLinks, setRegistrationLinks] = useState<RegistrationLink[]>([])
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  
  // Add player form state
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerEmail, setNewPlayerEmail] = useState('')
  const [newPlayerPhone, setNewPlayerPhone] = useState('')
  const [newPlayerVenmo, setNewPlayerVenmo] = useState('')
  
  // Add existing player state
  const [existingPlayers, setExistingPlayers] = useState<{ id: string; name: string; email: string | null }[]>([])
  const [selectedExistingPlayerId, setSelectedExistingPlayerId] = useState('')
  const [addingExistingPlayer, setAddingExistingPlayer] = useState(false)

  useEffect(() => {
    const identifier = slug || id
    if (!identifier || !user) return
    const poolIdentifier = identifier // Capture for TypeScript narrowing
    const userId = user.id

    async function loadPool() {
      try {
        setLoading(true)
        setLoadingPlayers(true)
        const poolData = await getPool(poolIdentifier)
        setPool(poolData)
        
        const owner = await isPoolOwner(poolData.id, userId)
        setIsOwner(owner)

        // Load players
        const poolPlayers = await getPoolPlayers(poolData.id)
        setPlayers(poolPlayers)

        // Load sessions
        const poolSessions = await getUpcomingSessions(poolData.id)
        setSessions(poolSessions)

        // Load registration links and existing players if owner
        if (owner) {
          const [links, availablePlayers] = await Promise.all([
            getRegistrationLinks(poolData.id),
            getPlayersNotInPool(poolData.id),
          ])
          setRegistrationLinks(links)
          setExistingPlayers(availablePlayers)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load pool')
      } finally {
        setLoading(false)
        setLoadingPlayers(false)
        setLoadingSessions(false)
      }
    }

    loadPool()
  }, [id, slug, user])

  const handleGenerateLink = async () => {
    if (!pool) return

    try {
      setGeneratingLink(true)
      const newLink = await createRegistrationLink(pool.id)
      setRegistrationLinks([newLink, ...registrationLinks])
      
      // Auto-copy the new link to clipboard
      const url = `${window.location.origin}/register/${newLink.token}`
      await navigator.clipboard.writeText(url)
      setCopiedToken(newLink.token)
      setTimeout(() => setCopiedToken(null), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to generate registration link')
    } finally {
      setGeneratingLink(false)
    }
  }

  const copyRegistrationUrl = (token: string) => {
    const url = `${window.location.origin}/register/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pool || !newPlayerName.trim() || !newPlayerVenmo.trim()) return

    try {
      setAddingPlayer(true)
      setError(null)
      const newPlayer = await createPlayerAndAddToPool(pool.id, {
        name: newPlayerName.trim(),
        email: newPlayerEmail.trim() || undefined,
        phone: newPlayerPhone.trim() || undefined,
        venmo_account: newPlayerVenmo.trim(),
      })
      
      // Add to players list
      setPlayers([...players, newPlayer])
      
      // Reset form
      setNewPlayerName('')
      setNewPlayerEmail('')
      setNewPlayerPhone('')
      setNewPlayerVenmo('')
      setShowAddPlayer(false)
    } catch (err: any) {
      setError(err.message || 'Failed to add player')
    } finally {
      setAddingPlayer(false)
    }
  }

  const handleAddExistingPlayer = async () => {
    if (!pool || !selectedExistingPlayerId) return

    try {
      setAddingExistingPlayer(true)
      setError(null)
      await addExistingPlayerToPool(pool.id, selectedExistingPlayerId)
      
      // Reload players list
      const updatedPlayers = await getPoolPlayers(pool.id)
      setPlayers(updatedPlayers)
      
      // Reload available players
      const availablePlayers = await getPlayersNotInPool(pool.id)
      setExistingPlayers(availablePlayers)
      
      setSelectedExistingPlayerId('')
    } catch (err: any) {
      setError(err.message || 'Failed to add player to pool')
    } finally {
      setAddingExistingPlayer(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3CBBB1]"></div>
      </div>
    )
  }

  if (error || !pool) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            {error || 'Pool not found'}
          </p>
          <Link
            to="/dashboard"
            className="text-[#3CBBB1] hover:text-[#35a8a0] mt-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="text-[#3CBBB1] hover:text-[#35a8a0] text-sm mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {pool.name}
            </h1>
            {pool.description && (
              <p className="text-gray-600 mt-2">{pool.description}</p>
            )}
          </div>
          {isOwner && (
            <span className="bg-blue-100 text-blue-800 text-xs sm:text-sm px-3 py-1 rounded-full">
              Owner
            </span>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Players Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Players</h2>
            {isOwner && (
              <button
                onClick={handleGenerateLink}
                disabled={generatingLink}
                className="text-sm bg-[#3CBBB1] text-white px-3 py-1 rounded hover:bg-[#35a8a0] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingLink ? 'Generating...' : 'Generate Link'}
              </button>
            )}
          </div>
          {loadingPlayers ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#3CBBB1]"></div>
            </div>
          ) : players.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No players in this pool yet. Generate a registration link to invite players.
            </p>
          ) : (
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="p-3 bg-gray-50 rounded-lg overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-gray-900 min-w-0 break-words">{player.name}</div>
                    <div className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      Joined {new Date(player.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                  {/* Only show contact info to pool owners */}
                  {isOwner && (
                    <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                      {player.email && (
                        <div className="truncate">{player.email}</div>
                      )}
                      {player.phone && (
                        <div>{formatPhone(player.phone)}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Existing Player Dropdown (Admin only) */}
          {isOwner && existingPlayers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add Existing Player
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedExistingPlayerId}
                  onChange={(e) => setSelectedExistingPlayerId(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
                >
                  <option value="">Select a player...</option>
                  {existingPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}{player.email ? ` (${player.email})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddExistingPlayer}
                  disabled={!selectedExistingPlayerId || addingExistingPlayer}
                  className="px-4 py-2 text-sm bg-[#3CBBB1] text-white rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {addingExistingPlayer ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {/* Add New Player Form (Admin only) */}
          {isOwner && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              {!showAddPlayer ? (
                <button
                  onClick={() => setShowAddPlayer(true)}
                  className="text-sm text-[#3CBBB1] hover:text-[#35a8a0] transition"
                >
                  + Create New Player
                </button>
              ) : (
                <form onSubmit={handleAddPlayer} className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Create New Player</h3>
                  <div>
                    <input
                      type="text"
                      placeholder="Name *"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <div className="flex items-center">
                      <span className="px-3 py-2 text-sm bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-500">@</span>
                      <input
                        type="text"
                        placeholder="Venmo username *"
                        value={newPlayerVenmo}
                        onChange={(e) => setNewPlayerVenmo(e.target.value.replace(/^@/, ''))}
                        required
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <input
                      type="email"
                      placeholder="Email (optional)"
                      value={newPlayerEmail}
                      onChange={(e) => setNewPlayerEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Phone (optional)"
                      value={newPlayerPhone}
                      onChange={(e) => setNewPlayerPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={addingPlayer || !newPlayerName.trim() || !newPlayerVenmo.trim()}
                      className="flex-1 bg-[#3CBBB1] text-white py-2 px-4 text-sm rounded-md hover:bg-[#35a8a0] focus:outline-none focus:ring-2 focus:ring-[#3CBBB1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {addingPlayer ? 'Adding...' : 'Add Player'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddPlayer(false)
                        setNewPlayerName('')
                        setNewPlayerEmail('')
                        setNewPlayerPhone('')
                        setNewPlayerVenmo('')
                      }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {isOwner && registrationLinks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Registration Links
              </h3>
              <div className="space-y-2">
                {registrationLinks.map((link) => {
                  const isExpired = new Date(link.expires_at) < new Date()
                  const isUsed = link.used_at !== null

                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-gray-600 truncate font-mono">
                            {link.token.substring(0, 16)}...
                          </code>
                          {isUsed && (
                            <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">
                              Used
                            </span>
                          )}
                          {isExpired && !isUsed && (
                            <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-xs">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500">
                          {link.used_at
                            ? `Used ${new Date(link.used_at).toLocaleDateString()}`
                            : isExpired
                            ? `Expired ${new Date(link.expires_at).toLocaleDateString()}`
                            : `Expires ${new Date(link.expires_at).toLocaleDateString()}`}
                        </div>
                      </div>
                      {!isUsed && !isExpired && (
                        <button
                          onClick={() => copyRegistrationUrl(link.token)}
                          className="ml-2 text-[#3CBBB1] hover:text-[#35a8a0] text-xs whitespace-nowrap"
                        >
                          {copiedToken === link.token ? 'Copied!' : 'Copy URL'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sessions Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Sessions
            </h2>
            {isOwner && (
              <Link
                to={`/s/new?pool=${pool.id}`}
                className="text-sm bg-[#3CBBB1] text-white px-3 py-1 rounded hover:bg-[#35a8a0] transition"
              >
                New Session
              </Link>
            )}
          </div>
          {loadingSessions ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#3CBBB1]"></div>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No upcoming sessions. Create one to get started!
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const sessionDate = new Date(session.proposed_date)
                const isToday = sessionDate.toDateString() === new Date().toDateString()
                const isPast = sessionDate < new Date() && !isToday

                return (
                  <Link
                    key={session.id}
                    to={`/s/${session.id}`}
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {isToday
                            ? 'Today'
                            : isPast
                            ? sessionDate.toLocaleDateString()
                            : sessionDate.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                          {' at '}
                          {new Date(`2000-01-01T${session.proposed_time}`).toLocaleTimeString(
                            'en-US',
                            {
                              hour: 'numeric',
                              minute: '2-digit',
                            }
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {session.court_location || 'Location TBD'}
                          {session.court_numbers && session.court_numbers.length > 0 && (
                            <span> • {session.court_numbers.length === 1 
                              ? `Court ${session.court_numbers[0]}`
                              : `Courts ${session.court_numbers.join(', ')}`}</span>
                          )}
                          {' • '}{session.duration_minutes} min
                          {session.status === 'confirmed' && (
                            <span className="ml-2 text-green-600">✓ Confirmed</span>
                          )}
                        </div>
                      </div>
                      <div className="text-gray-400">
                        →
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pool Info */}
      <div className="mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Pool Information
        </h2>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900 mt-1">
              {new Date(pool.created_at).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="text-gray-900 mt-1">
              {pool.is_active ? 'Active' : 'Inactive'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

