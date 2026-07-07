import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ACCEPTED_TYPES = ['.glb', '.ply', '.sog', '.splat', '.spz', '.ksplat']

export default function Upload() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (!selected) return

    const ext = '.' + selected.name.split('.').pop().toLowerCase()
    if (!ACCEPTED_TYPES.includes(ext)) {
      setError('Only .glb, .ply, and .sog files are allowed')
      return
    }

    if (selected.size > 50 * 1024 * 1024) {
      setError('File size must be under 50MB (Supabase free tier limit)')
      return
    }

    setError('')
    setFile(selected)
    setName(selected.name.replace(/\.[^/.]+$/, ''))
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop().toLowerCase()
    const filePath = `${user.id}/${Date.now()}.${ext}`

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, file)

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    // Parse comma-separated tags into a clean, lowercased array
    const tagList = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    // Save metadata to database
    const { error: dbError } = await supabase
      .from('assets')
      .insert({
        user_id: user.id,
        name: name,
        file_path: filePath,
        file_type: ext,
        size: file.size,
        is_public: isPublic,
        tags: tagList,
      })

    if (dbError) {
      setError(dbError.message)
      setUploading(false)
      return
    }

    navigate('/dashboard')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">Upload Scan</h1>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className="flex flex-col gap-6">

        {/* File Drop Zone */}
        <div
          className="border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl p-12 text-center transition cursor-pointer"
          onClick={() => document.getElementById('fileInput').click()}
        >
          {file ? (
            <div>
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-gray-400 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-400">Drag & drop or click to select</p>
              <p className="text-gray-600 text-sm mt-1">Models: .glb • Splats: .ply, .sog, .splat, .spz</p>
            </div>
          )}
          <input
            id="fileInput"
            type="file"
            accept=".glb,.ply,.sog,.splat,.spz,.ksplat"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Name */}
        <div>
          <label className="text-gray-400 text-sm mb-2 block">Scan Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Enter a name for this scan"
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-gray-400 text-sm mb-2 block">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. building, historical, detmold"
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
          />
          <p className="text-gray-600 text-xs mt-1">Separate tags with commas</p>
        </div>

        {/* Public Toggle */}
        <div className="flex items-center justify-between bg-gray-900 px-4 py-3 rounded-lg border border-gray-800">
          <div>
            <p className="text-white text-sm font-medium">Make Public</p>
            <p className="text-gray-500 text-xs">Anyone with the link can view this scan</p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            className={`w-12 h-6 rounded-full transition-colors ${isPublic ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full mx-auto transition-transform ${isPublic ? 'translate-x-3' : '-translate-x-3'}`} />
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!file || uploading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg transition font-medium"
        >
          {uploading ? 'Uploading...' : 'Upload Scan'}
        </button>

      </form>
    </div>
  )
}
