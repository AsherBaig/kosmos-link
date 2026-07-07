import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatSize } from '../lib/format'

export default function Gallery() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState(null)

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

  // Unique list of all tags across public scans, for the filter bar
  const allTags = [...new Set(assets.flatMap((a) => a.tags || []))].sort()

  // Apply the active tag filter
  const visibleAssets = activeTag
    ? assets.filter((a) => (a.tags || []).includes(activeTag))
    : assets

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Gallery</h1>
        <p className="text-gray-400 text-sm">Explore public 3D scans and models shared by the community</p>
      </div>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTag(null)}
            className={`text-xs px-3 py-1 rounded-full transition ${
              !activeTag ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`text-xs px-3 py-1 rounded-full transition ${
                activeTag === tag ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {visibleAssets.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
          <p className="text-gray-400">No public scans yet</p>
          <p className="text-gray-600 text-sm mt-1">Be the first to share one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleAssets.map(asset => (
            <Link
              key={asset.id}
              to={`/viewer/${asset.id}`}
              className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl p-4 transition group"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gray-950 rounded-lg mb-4 flex items-center justify-center border border-gray-800 overflow-hidden">
                {asset.thumbnail_url ? (
                  <img
                    src={asset.thumbnail_url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">🧊</span>
                )}
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

              {asset.tags && asset.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {asset.tags.map((tag) => (
                    <span key={tag} className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
