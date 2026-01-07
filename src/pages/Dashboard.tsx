import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { getPools, Pool } from '../lib/pools'

export default function Dashboard() {
  const { user } = useAuth()
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function loadPools() {
      try {
        const data = await getPools(user.id)
        setPools(data)
      } catch (err) {
        console.error('Failed to load pools:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPools()
  }, [user])

  return (
    <div className="max-w-6xl mx-auto w-full">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">
        Dashboard
      </h1>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6">
        <p className="text-base sm:text-lg text-gray-600">
          Welcome, <span className="font-medium">{user?.email}</span>!
        </p>
      </div>

      {/* Pools Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Pools</h2>
          <Link
            to="/pools/new"
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Create Pool
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : pools.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 mb-4">You don't have any pools yet.</p>
            <Link
              to="/pools/new"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Create Your First Pool
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pools.slice(0, 6).map((pool) => (
              <Link
                key={pool.id}
                to={`/pools/${pool.id}`}
                className="bg-white rounded-lg shadow hover:shadow-md transition p-4 block"
              >
                <h3 className="font-semibold text-gray-900 mb-1">{pool.name}</h3>
                {pool.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                    {pool.description}
                  </p>
                )}
                <span className="text-xs text-gray-500">
                  {pool.owner_id === user?.id ? 'Owner' : 'Member'}
                </span>
              </Link>
            ))}
          </div>
        )}

        {pools.length > 6 && (
          <div className="mt-4 text-center">
            <Link
              to="/pools"
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              View all {pools.length} pools →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

