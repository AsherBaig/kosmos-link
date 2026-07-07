import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Comments({ assetId }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [assetId])

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })

    if (!error) setComments(data)
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return

    setPosting(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({
        asset_id: assetId,
        user_id: user.id,
        author_email: user.email,
        body: body.trim(),
      })
      .select()
      .single()

    if (!error && data) {
      setComments([data, ...comments])
      setBody('')
    }
    setPosting(false)
  }

  const handleDelete = async (id) => {
    await supabase.from('comments').delete().eq('id', id)
    setComments(comments.filter((c) => c.id !== id))
  }

  return (
    <div className="mt-8 max-w-2xl">
      <h2 className="text-lg font-semibold text-white mb-4">
        Comments {comments.length > 0 && <span className="text-gray-500">({comments.length})</span>}
      </h2>

      {user ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-6">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 resize-none"
          />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="self-end bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition text-sm font-medium"
          >
            {posting ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      ) : (
        <p className="text-gray-500 text-sm mb-6">Sign in to leave a comment.</p>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-gray-500 text-sm">No comments yet. Be the first!</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-blue-400 text-sm font-medium">
                  {c.author_email || 'Anonymous'}
                </span>
                <span className="text-gray-600 text-xs">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{c.body}</p>
              {user?.id === c.user_id && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-red-400 hover:text-red-300 text-xs mt-2"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
