import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()

  return (
    <nav className="bg-[#2D3640] shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo - goes to dashboard when logged in, home when not */}
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <img src="/logo.png" alt="DinkUp" className="h-10 w-auto" />
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <span className="hidden sm:inline text-xs sm:text-sm text-white/60 truncate max-w-[150px]">
                  {user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-sm sm:text-base text-white/80 hover:text-white px-3 py-1.5 rounded hover:bg-white/10 transition"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm sm:text-base text-[#C4D600] hover:text-[#d4e600] px-3 py-1.5 rounded hover:bg-white/10 transition"
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

