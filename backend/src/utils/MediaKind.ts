export type MediaKind = 'image' | 'gif' | 'video' | 'media'

const KNOWN_KINDS: MediaKind[] = ['image', 'gif', 'video']

// TheParser marks every picture and video it renders with data-media. Html saved
// before it did, or markup it never renders, has no known kind.
const MEDIA_ATTRIBUTE = /<[a-z]+\b[^>]*\sdata-media="([a-z]+)"/gi

// What a piece of rendered html without text is made of: the one kind all of its
// media agree on (a GIF among pictures still makes pictures), otherwise 'media' —
// also when nothing in it carries a known kind.
export const getMediaKind = (html: string): MediaKind => {
  const kinds: string[] = []
  let match: RegExpExecArray | null
  MEDIA_ATTRIBUTE.lastIndex = 0
  while ((match = MEDIA_ATTRIBUTE.exec(html))) {
    kinds.push(match[1])
  }
  const pictures = kinds.includes('image') ? kinds.map((kind) => (kind === 'gif' ? 'image' : kind)) : kinds
  const unique = new Set(pictures)
  const [kind] = pictures as MediaKind[]
  return unique.size === 1 && KNOWN_KINDS.includes(kind) ? kind : 'media'
}
