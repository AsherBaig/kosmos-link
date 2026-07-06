import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAssets()
  }, [])

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error) setAssets(data)
    setLoading(false)
  }

  const handleDelete = async (id, filePath) => {
    await supabase.storage.from('assets').remove([filePath])
    await supabase.from('assets').delete().eq('id', id)
    setAssets(assets.filter(a => a.id !== id))
  }

  const handleTogglePublic = async (id, currentValue) => {
    await supabase.from('assets').update({ is_public: !currentValue }).eq('id', id)
    setAssets(assets.map(a => a.id === id ? { ...a, is_public: !currentValue } : a))
  }

  const getShareUrl = (id) => `${window.location.origin}/viewer/${id}`

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">My Scans</h1>
        <Link to="/upload" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm">
          + Upload New
        </Link>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
          <p className="text-gray-400 mb-4">No scans yet</p>
          <Link to="/upload" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition">
            Upload your first scan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map(asset => (
            <div key={asset.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              {/* File Type Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded font-medium uppercase">
                  {asset.file_type}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${asset.is_public ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                  {asset.is_public ? 'Public' : 'Private'}
                </span>
              </div>

              {/* Name */}
              <h3 className="text-white font-medium mb-1">{asset.name}</h3>
              <p className="text-gray-500 text-xs mb-4">
                {(asset.size / 1024 / 1024).toFixed(2)} MB • {new Date(asset.created_at).toLocaleDateString()}
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Link
                  to={`/viewer/${asset.id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded-lg transition text-sm"
                >
                  Open Viewer
                </Link>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getShareUrl(asset.id))
                      alert('Link copied!')
                    }}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg transition text-sm"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => handleTogglePublic(asset.id, asset.is_public)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg transition text-sm"
                  >
                    {asset.is_public ? 'Make Private' : 'Make Public'}
                  </button>
                </div>
                <button
                  onClick={() => handleDelete(asset.id, asset.file_path)}
                  className="bg-red-900/50 hover:bg-red-900 text-red-400 py-2 rounded-lg transition text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
