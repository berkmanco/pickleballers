import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()

  return (
    <nav className="bg-[#2D3640] shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="DinkUp" className="h-10 w-auto" />
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <Link
                  to="/pools"
                  className="text-sm sm:text-base text-white/80 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                >
                  Pools
                </Link>
                <Link
                  to="/dashboard"
                  className="text-sm sm:text-base text-white/80 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-sm sm:text-base text-white/80 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                >
                  Sign Out
                </button>
                <span className="hidden sm:inline text-xs sm:text-sm text-white/50 truncate max-w-[120px] sm:max-w-none">
                  {user.email}
                </span>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm sm:text-base text-[#C4D600] hover:text-[#d4e600] px-2 py-1 rounded hover:bg-white/10"
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

