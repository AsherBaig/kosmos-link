import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatSize } from '../lib/format'

export default function Gallery() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublicAssets()
  }, [])

  const fetchPublicAssets = async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (!error) setAssets(data)
    setLoading(false)
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Gallery</h1>
        <p className="text-gray-400 text-sm">Explore public 3D scans and models shared by the community</p>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
          <p className="text-gray-400">No public scans yet</p>
          <p className="text-gray-600 text-sm mt-1">Be the first to share one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map(asset => (
            <Link
              key={asset.id}
              to={`/viewer/${asset.id}`}
              className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl p-4 transition group"
            >
              {/* Thumbnail placeholder */}
              <div className="aspect-video bg-gray-950 rounded-lg mb-4 flex items-center justify-center border border-gray-800">
                <span className="text-4xl">🧊</span>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded font-medium uppercase">
                  {asset.file_type}
                </span>
                <span className="text-gray-500 text-xs">
                  {new Date(asset.created_at).toLocaleDateString()}
                </span>
              </div>

              <h3 className="text-white font-medium group-hover:text-blue-400 transition">
                {asset.name}
              </h3>
              <p className="text-gray-500 text-xs mt-1">
                {formatSize(asset.size)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
