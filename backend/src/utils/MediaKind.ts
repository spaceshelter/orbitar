export type MediaKind = 'image' | 'gif' | 'video' | 'media'

// TheParser wraps YouTube, Vimeo, Coub and hosted video with a poster in
// <a class="…-embed"> around a preview <img>; any other embed is of unknown kind.
const EMBED_ANCHOR = /<a\b[^>]*\bclass="(?:[^"]*\s)?([\w-]+)-embed(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/a>/gi
const VIDEO_EMBEDS = ['youtube', 'vimeo', 'coub', 'video']
const MEDIA_TAG = /<(img|video|iframe|object|embed|audio)\b[^>]*>/gi
const SOURCE = /\bsrc="([^"]*)"/i
const VIDEO_FRAME = /^(https?:)?\/\/([\w-]+\.)?(youtube\.com|youtube-nocookie\.com|vimeo\.com|coub\.com)\//i
const GIF = /^data:image\/gif|\.gif([?#]|$)|^(https?:)?\/\/([\w-]+\.)*(tenor\.com|giphy\.com)\//i

const tagKind = (tag: string, name: string): MediaKind => {
  const src = SOURCE.exec(tag)?.[1] || ''
  switch (name.toLowerCase()) {
    case 'img':
      return GIF.test(src) ? 'gif' : 'image'
    case 'video':
      return 'video'
    case 'iframe':
      return VIDEO_FRAME.test(src) ? 'video' : 'media'
    default:
      return 'media'
  }
}

// What a piece of rendered html without text is made of: the one kind all of its
// media agree on (a GIF among pictures still makes pictures), otherwise 'media' —
// also when nothing in it is recognised.
export const getMediaKind = (html: string): MediaKind => {
  const kinds: MediaKind[] = []
  const rest = html.replace(EMBED_ANCHOR, (_anchor, name: string) => {
    kinds.push(VIDEO_EMBEDS.includes(name.toLowerCase()) ? 'video' : 'media')
    return ''
  })
  let match: RegExpExecArray | null
  MEDIA_TAG.lastIndex = 0
  while ((match = MEDIA_TAG.exec(rest))) {
    kinds.push(tagKind(match[0], match[1]))
  }
  const pictures = kinds.includes('image') ? kinds.map((kind) => (kind === 'gif' ? 'image' : kind)) : kinds
  const unique = new Set(pictures)
  return unique.size === 1 ? pictures[0] : 'media'
}
