import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-white">
          KOSMOS-Link
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/gallery" className="text-gray-400 hover:text-white transition">Gallery</Link>
          {user && (
            <>
              <Link to="/upload" className="text-gray-400 hover:text-white transition">Upload</Link>
              <Link to="/dashboard" className="text-gray-400 hover:text-white transition">Dashboard</Link>
              <Link to="/compose" className="text-gray-400 hover:text-white transition">Compose</Link>
            </>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg transition text-sm"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
