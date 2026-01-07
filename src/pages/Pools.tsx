import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPools, Pool } from '../lib/pools'

export default function Pools() {
  const { user } = useAuth()
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return

    // Capture values to avoid stale closures
    const userId = user.id
    const userEmail = user.email

    async function loadPools() {
      try {
        setLoading(true)
        const data = await getPools(userId, userEmail || undefined)
        setPools(data)
      } catch (err: any) {
        console.error('Pools page: error', err)
        setError(err.message || 'Failed to load pools')
      } finally {
        setLoading(false)
      }
    }

    loadPools()
    // Only re-run when user ID changes (email is stable for a logged-in user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pools</h1>
        <Link
          to="/pools/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm sm:text-base"
        >
          Create Pool
        </Link>
      </div>

      {pools.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">You don't have any pools yet.</p>
          <Link
            to="/pools/new"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {pool.name}
              </h2>
              {pool.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {pool.description}
                </p>
              )}
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500">
                <span>
                  {pool.owner_id === user?.id ? 'Owner' : 'Member'}
                </span>
                <span>
                  {new Date(pool.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

