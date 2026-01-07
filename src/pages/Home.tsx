import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#2D3640]">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
        <img 
          src="/logo.png" 
          alt="DinkUp" 
          className="w-32 sm:w-40 mx-auto mb-6"
        />
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
          DinkUp
        </h1>
        <p className="text-xl sm:text-2xl text-white/80 mb-10 font-light">
          Less planning. More dinking.
        </p>
        
        {user ? (
          <Link
            to="/dashboard"
            className="inline-block bg-[#C4D600] text-[#2D3640] px-8 py-4 rounded-lg hover:bg-[#d4e600] transition font-semibold text-lg"
          >
            Go to Dashboard
          </Link>
        ) : (
          <Link
            to="/login"
            className="inline-block bg-[#C4D600] text-[#2D3640] px-8 py-4 rounded-lg hover:bg-[#d4e600] transition font-semibold text-lg"
          >
            Get Started
          </Link>
        )}
      </div>

      {/* Features Section */}
      <div className="bg-white/5 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur p-6 rounded-xl border border-white/10">
              <div className="text-3xl mb-3">🙋</div>
              <h3 className="text-lg font-semibold mb-2 text-white">Self-Service</h3>
              <p className="text-white/70">
                Players opt themselves in. No more group text coordination.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur p-6 rounded-xl border border-white/10">
              <div className="text-3xl mb-3">💸</div>
              <h3 className="text-lg font-semibold mb-2 text-white">Easy Payments</h3>
              <p className="text-white/70">
                Venmo links sent automatically when players commit.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur p-6 rounded-xl border border-white/10">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="text-lg font-semibold mb-2 text-white">Waitlist Management</h3>
              <p className="text-white/70">
                Automatic promotion when spots open up.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-10">How it works</h2>
          <div className="grid md:grid-cols-4 gap-4 text-left">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-[#3CBBB1] text-white rounded-full flex items-center justify-center font-bold">1</span>
              <div>
                <p className="text-white font-medium">Create a pool</p>
                <p className="text-white/60 text-sm">Invite your crew</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-[#3CBBB1] text-white rounded-full flex items-center justify-center font-bold">2</span>
              <div>
                <p className="text-white font-medium">Propose a session</p>
                <p className="text-white/60 text-sm">Pick date & time</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-[#3CBBB1] text-white rounded-full flex items-center justify-center font-bold">3</span>
              <div>
                <p className="text-white font-medium">Players opt in</p>
                <p className="text-white/60 text-sm">Self-service style</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-[#3CBBB1] text-white rounded-full flex items-center justify-center font-bold">4</span>
              <div>
                <p className="text-white font-medium">Play pickleball!</p>
                <p className="text-white/60 text-sm">Payments handled</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
