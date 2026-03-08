const INLINE_TAGS = new Set(['b', 'i', 'u', 'strike'])

export function renderEncryptedContentHtml(source: string) {
  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html')
  return renderNodes(Array.from(doc.body.childNodes), false)
}

function renderNodes(nodes: ChildNode[], preserveWhitespace: boolean): string {
  return nodes
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return renderText(node.textContent || '', preserveWhitespace)
      }

      if (!(node instanceof HTMLElement)) {
        return ''
      }

      const tagName = node.tagName.toLowerCase()
      if (INLINE_TAGS.has(tagName)) {
        return `<${tagName}>${renderNodes(Array.from(node.childNodes), preserveWhitespace)}</${tagName}>`
      }

      if (tagName === 'br') {
        return '<br/>'
      }

      if (tagName === 'a') {
        const href = sanitizeLink(node.getAttribute('href'))
        const body = renderNodes(Array.from(node.childNodes), false)
        return href ? `<a href='${escapeAttribute(href)}' target='_blank' rel='noreferrer noopener'>${body}</a>` : body
      }

      if (tagName === 'img') {
        const src = sanitizeMediaUrl(node.getAttribute('src'))
        if (!src) {
          return ''
        }

        return `<img src='${escapeAttribute(src)}' alt='${escapeAttribute(node.getAttribute('alt') || '')}' />`
      }

      if (tagName === 'video') {
        const src = sanitizeMediaUrl(node.getAttribute('src'))
        if (!src) {
          return ''
        }

        return `<video src='${escapeAttribute(src)}' controls></video>`
      }

      if (tagName === 'blockquote') {
        return `<blockquote>${renderNodes(Array.from(node.childNodes), false)}</blockquote>`
      }

      if (tagName === 'pre') {
        return `<pre>${escapeHtml(node.textContent || '')}</pre>`
      }

      return escapeHtml(node.outerHTML)
    })
    .join('')
}

function renderText(text: string, preserveWhitespace: boolean): string {
  const escaped = escapeHtml(text)
  return preserveWhitespace ? escaped : escaped.replace(/\n/g, '<br/>')
}

function sanitizeLink(href: string | null): string | null {
  if (!href) {
    return null
  }

  try {
    const url = new URL(href, window.location.origin)
    if (['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      return url.toString()
    }
  } catch (error) {}

  return null
}

function sanitizeMediaUrl(src: string | null): string | null {
  if (!src) {
    return null
  }

  try {
    const url = new URL(src, window.location.origin)
    if (['http:', 'https:'].includes(url.protocol)) {
      return url.toString()
    }
  } catch (error) {}

  return null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}
