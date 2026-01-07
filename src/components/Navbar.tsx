import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link to="/" className="text-lg sm:text-xl font-bold text-gray-900">
            Pickleballers
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm sm:text-base text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-50"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-sm sm:text-base text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-50"
                >
                  Sign Out
                </button>
                <span className="hidden sm:inline text-xs sm:text-sm text-gray-500 truncate max-w-[120px] sm:max-w-none">
                  {user.email}
                </span>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm sm:text-base text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

