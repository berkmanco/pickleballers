import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPool, isPoolOwner, Pool } from '../lib/pools'

export default function PoolDetails() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pool, setPool] = useState<Pool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    const identifier = slug || id
    if (!identifier || !user) return

    async function loadPool() {
      try {
        setLoading(true)
        const poolData = await getPool(identifier)
        setPool(poolData)
        
        const owner = await isPoolOwner(poolData.id, user.id)
        setIsOwner(owner)
      } catch (err: any) {
        setError(err.message || 'Failed to load pool')
      } finally {
        setLoading(false)
      }
    }

    loadPool()
  }, [id, slug, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            to="/pools"
            className="text-blue-600 hover:text-blue-700 mt-2 inline-block"
          >
            ← Back to Pools
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          to="/pools"
          className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block"
        >
          ← Back to Pools
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Players
          </h2>
          <p className="text-gray-500 text-sm">
            Player management coming soon...
          </p>
          {isOwner && (
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-700">
              Generate Registration Link
            </button>
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
                to={`/sessions/new?pool=${pool.id}`}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
              >
                New Session
              </Link>
            )}
          </div>
          <p className="text-gray-500 text-sm">
            Sessions coming soon...
          </p>
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

