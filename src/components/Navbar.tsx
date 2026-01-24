import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getFirstName } from '../lib/utils'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch player name
  useEffect(() => {
    if (!user) {
      setPlayerName(null)
      return
    }

    const userId = user.id

    async function fetchPlayerName() {
      const { data } = await supabase
        .from('players')
        .select('name')
        .eq('user_id', userId)
        .single()

      if (data?.name) {
        setPlayerName(data.name)
      }
    }

    fetchPlayerName()
  }, [user])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = playerName ? getFirstName(playerName) : user?.email?.split('@')[0] || 'Account'

  return (
    <nav className="bg-[#2D3640] shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo - goes to dashboard when logged in, home when not */}
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <img src="/logo.png" alt="DinkUp" className="h-10 w-auto" />
            <span className="text-white text-xl font-bold">DinkUp</span>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 text-sm sm:text-base text-white/80 hover:text-white px-3 py-1.5 rounded hover:bg-white/10 transition"
                >
                  <span className="truncate max-w-[150px]">{displayName}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
                    <Link
                      to="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setDropdownOpen(false)
                        signOut()
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
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
