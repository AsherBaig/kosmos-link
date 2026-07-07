import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FEATURES = [
  {
    icon: '🧊',
    title: 'Splat + GLB Viewer',
    desc: 'View Gaussian Splat scans and classic 3D models together in one browser-based WebGL viewer.',
  },
  {
    icon: '📍',
    title: 'Spatial Annotations',
    desc: 'Click anywhere in 3D space to pin comments — even on Gaussian Splat scenes.',
  },
  {
    icon: '🌐',
    title: 'Share & Collaborate',
    desc: 'Publish scans to a shared gallery, control public/private access, and download for reuse.',
  },
]

export default function Home() {
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    supabase
      .from('assets')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => setFeatured(data || []))
  }, [])

  return (
    <div className="py-12">
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          Share, view, and annotate<br />3D scans in your browser
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          A collaborative platform for Gaussian Splat scans and 3D models —
          built to preserve work across departments, from generation to generation.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/gallery" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition font-medium">
            Browse Gallery
          </Link>
          <Link to="/upload" className="border border-gray-600 hover:border-gray-400 text-gray-300 px-6 py-3 rounded-lg transition">
            Upload Scan
          </Link>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto mb-16">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="text-white font-semibold mb-2">{f.title}</h3>
            <p className="text-gray-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Featured scans */}
      {featured.length > 0 && (
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Featured Scans</h2>
            <Link to="/gallery" className="text-blue-400 hover:text-blue-300 text-sm">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featured.map((asset) => (
              <Link
                key={asset.id}
                to={`/viewer/${asset.id}`}
                className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl p-3 transition group"
              >
                <div className="aspect-video bg-gray-950 rounded-lg mb-3 flex items-center justify-center border border-gray-800 overflow-hidden">
                  {asset.thumbnail_url ? (
                    <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🧊</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-white text-sm font-medium truncate group-hover:text-blue-400 transition">
                    {asset.name}
                  </h3>
                  <span className="bg-blue-900 text-blue-300 text-xs px-1.5 py-0.5 rounded uppercase ml-2 shrink-0">
                    {asset.file_type}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
