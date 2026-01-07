import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  return (
    <div className={`min-h-screen ${isHomePage ? 'bg-[#2D3640]' : 'bg-gray-100'}`}>
      <Navbar />
      <main className={isHomePage ? '' : 'container mx-auto px-4 sm:px-6 py-4 sm:py-8'}>
        <Outlet />
      </main>
    </div>
  )
}

