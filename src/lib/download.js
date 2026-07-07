import { supabase } from './supabase'

// Download an asset's original scan file to the user's device.
export async function downloadAsset(asset) {
  const { data: { publicUrl } } = supabase.storage
    .from('assets')
    .getPublicUrl(asset.file_path)

  const res = await fetch(publicUrl)
  const blob = await res.blob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${asset.name}.${asset.file_type}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
