// Format a byte count into a human-readable string (KB or MB)
export function formatSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
