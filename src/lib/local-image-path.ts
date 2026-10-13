// Mechanical file authorization only: no intent classification, filesystem lookup, or scan.
// Keep ordinary Windows paths literal; URL percent decoding applies exactly once to file URLs.
function canonicalPath(input: string): string | null {
  let path = input.trim()
  if (!path || path.length > 32767 || /[\x00-\x1f\x7f]/.test(path)) return null
  const pairs: Record<string, string> = { '"': '"', "'": "'", '`': '`', '“': '”', '‘': '’' }
  if (pairs[path[0]] === path[path.length - 1]) path = path.slice(1, -1)
  if (/^file:/i.test(path)) {
    // Encoded separators and traversal cannot turn a displayed filename into another path.
    if (/%(?:00|2f|5c|3a)/i.test(path)) return null
    try {
      const decoded = decodeURIComponent(path)
      if (/(?:^|[\\/])\.{1,2}(?:[\\/]|$)/.test(decoded)) return null
      const url = new URL(path)
      if (url.protocol !== 'file:' || (url.hostname && url.hostname !== 'localhost') || url.search || url.hash || url.username || url.password) return null
      path = decodeURIComponent(url.pathname)
      if (/^\/[a-z]:[\\/]/i.test(path)) path = path.slice(1)
    } catch { return null }
  }
  path = path.replace(/\\/g, '/')
  if (!/^[a-z]:\//i.test(path) || /[:<>|?*"\x00-\x1f\x7f]/.test(path.slice(2))) return null
  const segments = path.slice(3).split('/')
  if (!segments.length || segments.some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part))) return null
  return path.toLowerCase()
}

// Drive names inside another filename/URL are not independent paths.
const pathStart = /(?:file:\/\/(?:localhost)?\/[a-z]:[\\/]|[a-z]:[\\/])/gi
const leftBoundary = (text: string, index: number) => index === 0 || !/[a-z0-9_./\\:%+\-]/i.test(text[index - 1])
const pictureEnd = /\.(?:png|jpe?g|gif|webp|bmp)(?=$|[\s"'`<>，。；！？）)\]}])/gi

/** Whether the exact local path is explicitly present in human user messages.
 * Quoted paths are indivisible; unquoted paths with spaces use their last image suffix,
 * so `photo.png other.png` never grants access to a different `photo.png` file.
 */
export function isExplicitLocalImagePath(path: string, userTexts: string[]): boolean {
  const candidate = canonicalPath(path)
  if (!candidate) return false
  for (const userText of userTexts) {
    let unquoted = userText
    const quoted = /"([^"\r\n]*)"|'([^'\r\n]*)'|`([^`\r\n]*)`|“([^”\r\n]*)”|‘([^’\r\n]*)’/g
    for (const match of userText.matchAll(quoted)) {
      const value = match.slice(1).find((part) => part !== undefined) || ''
      if (canonicalPath(value) === candidate) return true
      // Do not allow a path substring inside a quoted filename to pass the loose scan.
      unquoted = unquoted.slice(0, match.index) + ' '.repeat(match[0].length) + unquoted.slice(match.index! + match[0].length)
    }
    // A path in a webpage URL query/fragment is source text, not a local file selection.
    unquoted = unquoted.replace(/(?:[a-z][a-z0-9+.-]*:\/\/|data:)[^\s<>"'`]+/gi, (url) => /^file:/i.test(url) ? url : ' '.repeat(url.length))
    const starts = [...unquoted.matchAll(pathStart)].filter((match) => leftBoundary(unquoted, match.index!))
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i].index!
      const next = starts[i + 1]?.index ?? unquoted.length
      // A newline or Chinese prose punctuation terminates an unquoted path span.
      // Filenames containing these marks remain available through explicit quotes.
      const rest = unquoted.slice(start, next).split(/[\r\n"'`<>，。；！？]/, 1)[0]
      const ends = [...rest.matchAll(pictureEnd)]
      const last = ends[ends.length - 1]
      const explicit = last ? rest.slice(0, last.index! + last[0].length) : rest.trim()
      if (canonicalPath(explicit) === candidate) return true
    }
  }
  return false
}
