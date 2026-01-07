import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="max-w-6xl mx-auto w-full">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">Dashboard</h1>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
        <p className="text-base sm:text-lg text-gray-600">
          Welcome, <span className="font-medium">{user?.email}</span>!
        </p>
        <p className="text-sm sm:text-base text-gray-500 mt-2">
          Pool management, sessions, and more coming soon...
        </p>
      </div>
    </div>
  )
}

