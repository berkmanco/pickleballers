import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Pickleballers
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Coordinate pickleball games with friends and family
        </p>
        
        {user ? (
          <Link
            to="/dashboard"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </Link>
        ) : (
          <Link
            to="/login"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Get Started
          </Link>
        )}
      </div>

      <div className="mt-16 grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Self-Service</h3>
          <p className="text-gray-600">
            Players opt-in themselves. No more group text coordination.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Automatic Payments</h3>
          <p className="text-gray-600">
            Venmo links sent automatically when players commit.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Waitlist Management</h3>
          <p className="text-gray-600">
            Automatic promotion when spots open up.
          </p>
        </div>
      </div>
    </div>
  )
}

