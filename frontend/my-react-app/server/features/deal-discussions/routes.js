// Keep the public URLs stable while this feature uses a separate HTML entry.
export function isDealDiscussionPath(pathname) {
  try {
    const path = decodeURIComponent(pathname)
    return /^\/preview\/deal\/?$/.test(path) || /^\/deals\/[^/]+\/?$/.test(path)
  } catch {
    return false
  }
}
