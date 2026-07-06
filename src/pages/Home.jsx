import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Home() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Supabase error:', error)
      else console.log('Supabase connected ✅', data)
    })
  }, [])

  return (
    <div className="text-center py-20">
      <h1 className="text-5xl font-bold text-white mb-4">KOSMOS-Link</h1>
      <p className="text-gray-400 text-xl mb-8">
        Collaborative platform for 3D scans and Gaussian Splats
      </p>
      <div className="flex gap-4 justify-center">
        <Link to="/gallery" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition">
          Browse Gallery
        </Link>
        <Link to="/upload" className="border border-gray-600 hover:border-gray-400 text-gray-300 px-6 py-3 rounded-lg transition">
          Upload Scan
        </Link>
      </div>
    </div>
  )
}
