import TheParser from '../../src/parser/TheParser'

const p = new TheParser({
  mediaHosting: {
    url: 'https://orbitar.media',
    dimsAesKey: '',
  },
  siteDomain: 'orbitar.local',
})

test('parse A tag', () => {
  // already encoded
  expect(
    p.parse(
      '<a href="https://ru.wikipedia.org/wiki/%D0%A1%D0%BB%D0%B0%D0%B2%D0%B0_%D0%A3%D0%BA%D1%80%D0%B0%D0%B8%D0%BD%D0%B5">тест</a>',
    ).text,
  ).toEqual(
    '<a href="https://ru.wikipedia.org/wiki/%D0%A1%D0%BB%D0%B0%D0%B2%D0%B0_%D0%A3%D0%BA%D1%80%D0%B0%D0%B8%D0%BD%D0%B5" target="_blank">тест</a>',
  )

  // should be encoded
  expect(p.parse('<a href="https://ru.wikipedia.org/wiki/42_Дракона_b">тест</a>').text).toEqual(
    '<a href="https://ru.wikipedia.org/wiki/42_%D0%94%D1%80%D0%B0%D0%BA%D0%BE%D0%BD%D0%B0_b" target="_blank">тест</a>',
  )

  // invalid url in A tag
  expect(p.parse('<a href="http://1.1.1.1.1">t</a>').text).toEqual(
    '&lt;a href=&quot;http://1.1.1.1.1&quot;&gt;t&lt;/a&gt;',
  )

  // invalid url in A tag that is valid if escaped
  expect(p.parse('<a href="http://1.1.1.1/ 1">t</a>').text).toEqual(
    '<a href="http://1.1.1.1/%201" target="_blank">t</a>',
  )
})

test('detect url in text', () => {
  expect(p.parse('Hello, \n' + 'http://hello.world test\n' + 'the end').text).toEqual(
    'Hello, <br />\n' + '<a href="http://hello.world" target="_blank">http://hello.world</a> test<br />\n' + 'the end',
  )
})

test('return valid youtube url', () => {
  expect(p.parse('https://www.youtube.com/watch?v=aboZctrHfK8').text).toEqual(
    `<a class="youtube-embed" href="https://www.youtube.com/watch?v=aboZctrHfK8" target="_blank"><img src="https://img.youtube.com/vi/aboZctrHfK8/0.jpg" alt="" data-youtube="https://www.youtube.com/embed/aboZctrHfK8"/></a>`,
  )
})

test('youtube shorts', () => {
  expect(p.parse('https://youtube.com/shorts/XeZorMhBlzQ?feature=share').text).toEqual(
    `<a class="youtube-embed" href="https://www.youtube.com/watch?v=XeZorMhBlzQ" target="_blank"><img src="https://img.youtube.com/vi/XeZorMhBlzQ/0.jpg" alt="" data-youtube="https://www.youtube.com/embed/XeZorMhBlzQ"/></a>`,
  )
})

test('vimeo player embed', () => {
  expect(p.parse('https://www.vimeo.com/123456789').text).toEqual(
    `<a class="vimeo-embed" href="https://vimeo.com/123456789" target="_blank">` +
      `<img src="https://b.orbitar.media/vimeo/123456789" alt="" data-vimeo="https://player.vimeo.com/video/123456789"/></a>`,
  )
})

test('vimeo player illegal embed', () => {
  expect(p.parse('https://vimeo.com/user35789315?embedded=true&source=owner_name&owner=35789315').text).toEqual(
    `<a href="https://vimeo.com/user35789315?embedded=true&source=owner_name&owner=35789315" target="_blank">https://vimeo.com/user35789315?embedded=true&amp;source=owner_name&amp;owner=35789315</a>`,
  )
})

test('idiod video embed', () => {
  expect(p.parse('https://idiod.video/8feuw2.mp4').text).toEqual(
    `<a class="video-embed" href="https://idiod.video/8feuw2.mp4" target="_blank"><img src="https://idiod.video/preview/8feuw2.mp4" alt="" data-video="https://idiod.video/8feuw2.mp4"/></a>`,
  )
})

test('orbitar video embed', () => {
  expect(p.parse('https://orbitar.media/8feuw2.mp4').text).toEqual(
    `<a class="video-embed" href="https://orbitar.media/8feuw2.mp4" target="_blank"><img src="https://b.orbitar.media/preview/8feuw2.mp4" alt="" data-video="https://b.orbitar.media/8feuw2.mp4/raw"/></a>`,
  )
})

test('orbitar video embed origin', () => {
  expect(p.parse('https://origin.orbitar.media/8feuw2.mp4').text).toEqual(
    `<a class="video-embed" href="https://b.orbitar.media/8feuw2.mp4" target="_blank"><img src="https://b.orbitar.media/preview/8feuw2.mp4" alt="" data-video="https://b.orbitar.media/8feuw2.mp4/raw"/></a>`,
  )
})

test('raw orbitar video embed', () => {
  expect(p.parse('https://orbitar.media/8feuw2.mp4/raw').text).toEqual(
    `<a class="video-embed" href="https://orbitar.media/8feuw2.mp4/raw" target="_blank"><img src="https://b.orbitar.media/preview/8feuw2.mp4" alt="" data-video="https://b.orbitar.media/8feuw2.mp4/raw"/></a>`,
  )
})

test('origin orbitar video embed', () => {
  expect(p.parse('https://origin.orbitar.media/8feuw2.mp4/raw').text).toEqual(
    `<a class="video-embed" href="https://b.orbitar.media/8feuw2.mp4/raw" target="_blank"><img src="https://b.orbitar.media/preview/8feuw2.mp4" alt="" data-video="https://b.orbitar.media/8feuw2.mp4/raw"/></a>`,
  )
})

test('mp4 video element', () => {
  expect(
    p.parse('<video src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4">')
      .text,
  ).toEqual(
    `<video  preload="metadata" controls="" width="500"><source src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4" type="video/mp4"></video>`,
  )
})

test('coub embed', () => {
  expect(p.parse('https://coub.com/view/1eyshv').text).toEqual(
    `<a class="coub-embed" href="https://coub.com/view/1eyshv" target="_blank"><img src="https://b.orbitar.media/coub/1eyshv" alt="" data-coub="https://coub.com/embed/1eyshv"/></a>`,
  )
})

test('strip leading and trailing non-printable chars', () => {
  const orig = Buffer.from([0x00, 0x01, 0x20, 0x34, 0x32, 0x16, 0x20, 0x0d, 0x0a]).toString('utf8')
  const parsed = p.parse(orig).text
  expect(parsed).toEqual('42')
})

test('remove line breaks at the beginning and the end', () => {
  expect(p.parse('Hello, \n' + 'world').text).toEqual('Hello, <br />\n' + 'world')

  expect(p.parse('\nHello, \n' + 'world' + '\n').text).toEqual('Hello, <br />\n' + 'world')

  expect(p.parse('\n\n\nHello, \n' + 'world' + '\n\n\n').text).toEqual('Hello, <br />\n' + 'world')
})

test('remove extra line break after blockquote tag', () => {
  expect(p.parse('<blockquote>Hello</blockquote>\nworld').text).toEqual('<blockquote>Hello</blockquote>world')

  expect(p.parse('<blockquote>Hello</blockquote>\n\nworld').text).toEqual('<blockquote>Hello</blockquote><br />\nworld')

  expect(p.parse('<blockquote>Hello</blockquote>\n\n\nworld').text).toEqual(
    '<blockquote>Hello</blockquote><br />\nworld',
  )

  expect(p.parse('<blockquote>Hello\n<blockquote>world</blockquote>\n</blockquote>test').text).toEqual(
    '<blockquote>Hello<br />\n<blockquote>world</blockquote></blockquote>test',
  )
})

test('remove extra line break after expand tag', () => {
  expect(p.parse('<expand title="Brave">New</expand>\nWorld').text).toEqual(
    '<details class="expand"><summary>Brave</summary>New<div role="button"></div></details>World',
  )

  expect(p.parse('<expand title="Brave">New</expand>\n\nWorld').text).toEqual(
    '<details class="expand"><summary>Brave</summary>New<div role="button"></div></details><br />\nWorld',
  )

  expect(p.parse('<expand title="Brave">New</expand>\n\n\nWorld').text).toEqual(
    '<details class="expand"><summary>Brave</summary>New<div role="button"></div></details><br />\nWorld',
  )

  expect(p.parse('<expand title="Hello">World\n<expand title="Brave">New</expand>\n</expand>World').text).toEqual(
    '<details class="expand"><summary>Hello</summary>World<br />\n<details class="expand"><summary>Brave</summary>New<div role="button"></div></details><div role="button"></div></details>World',
  )
})

test('unwrap nested links', () => {
  expect(p.parse('<a href="https://test.com"><a href="https://test.com">test</a></a>').text).toEqual(
    '<a href="https://test.com" target="_blank">test</a>',
  )

  expect(p.parse('<a href="https://test.com">https://test2.com</a> test').text).toEqual(
    '<a href="https://test2.com" target="_blank">https://test2.com</a> test',
  )
})

test('mentions', () => {
  // `<a href="${encodeURI(`/u/${token.data}`)}" target="_blank" class="mention">${htmlEscape(token.data)}</a>`;

  function parse(text) {
    const res = p.parse(text)
    return [res.text, res.mentions]
  }

  expect(parse('@test')).toEqual(['<a href="/u/test" target="_blank" class="mention">test</a>', ['test']])

  expect(parse('@test test')).toEqual(['<a href="/u/test" target="_blank" class="mention">test</a> test', ['test']])

  expect(parse('@test test @test')).toEqual([
    '<a href="/u/test" target="_blank" class="mention">test</a> test <a href="/u/test" target="_blank" class="mention">test</a>',
    ['test'],
  ])

  expect(parse('@test test @test1')).toEqual([
    '<a href="/u/test" target="_blank" class="mention">test</a> test <a href="/u/test1" target="_blank" class="mention">test1</a>',
    ['test', 'test1'],
  ])

  // urls, text, mentions
  expect(parse('https://test.com @test test')).toEqual([
    '<a href="https://test.com" target="_blank">https://test.com</a> <a href="/u/test" target="_blank" class="mention">test</a> test',
    ['test'],
  ])

  // mentions in links take precedence
  expect(parse('<a href="https://test.com">@test</a>')).toEqual([
    '<a href="/u/test" target="_blank" class="mention">test</a>',
    ['test'],
  ])
})

test('parse html comment', () => {
  // returns escaped html comment as text
  expect(p.parse('<!-- test -->').text).toEqual('&lt;!-- test --&gt;')

  expect(p.parse('<!-- test -->test').text).toEqual('&lt;!-- test --&gt;test')

  expect(p.parse('test<!-- test -->').text).toEqual('test&lt;!-- test --&gt;')

  expect(p.parse('test<!-- test -->test').text).toEqual('test&lt;!-- test --&gt;test')

  expect(p.parse('test<!-- test -->test<!-- test -->test').text).toEqual(
    'test&lt;!-- test --&gt;test&lt;!-- test --&gt;test',
  )
})

test('parse html comment with html tags', () => {
  expect(p.parse('<!-- <a href="http://test.com">test</a> -->').text).toEqual(
    '&lt;!-- &lt;a href=&quot;http://test.com&quot;&gt;test&lt;/a&gt; --&gt;',
  )
})

test('parse html directive', () => {
  // returns escaped html directive as text
  expect(p.parse('<!DOCTYPE html>').text).toEqual('&lt;!DOCTYPE html&gt;')

  expect(p.parse('<!DOCTYPE html>test').text).toEqual('&lt;!DOCTYPE html&gt;test')

  expect(p.parse('test<!DOCTYPE html>').text).toEqual('test&lt;!DOCTYPE html&gt;')

  expect(p.parse('test<!DOCTYPE html>test').text).toEqual('test&lt;!DOCTYPE html&gt;test')

  expect(p.parse('test<!DOCTYPE html>test<!DOCTYPE html>test').text).toEqual(
    'test&lt;!DOCTYPE html&gt;test&lt;!DOCTYPE html&gt;test',
  )

  expect(p.parse('<?xml version="1.0" encoding="UTF-8"?>').text).toEqual(
    '&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?&gt;',
  )

  expect(p.parse('<?xml version="1.0" encoding="UTF-8"?>test').text).toEqual(
    '&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?&gt;test',
  )

  expect(p.parse('test<?xml version="1.0" encoding="UTF-8"?>').text).toEqual(
    'test&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?&gt;',
  )
})

test('parse malformed url', () => {
  expect(p.parse('<a href="https://test>test</a>%<img src="https://test"/>').text).toEqual(
    '&lt;a href=&quot;https://test&gt;test&lt;/a&gt;%&lt;img src=&quot; https:=&quot;&quot; test&quot;=&quot;&quot;/&gt;&lt;/a&gt;',
  )
})

test('parse spoiler tag', () => {
  expect(p.parse('<spoiler>Hello</spoiler>').text).toEqual('<span class="spoiler">Hello</span>')
})

test('parse expand tag', () => {
  // title
  expect(p.parse('<expand title="Hello">world</expand>').text).toEqual(
    '<details class="expand"><summary>Hello</summary>world<div role="button"></div></details>',
  )
  // empty title
  expect(p.parse('<expand>Hello world</expand>').text).toEqual(
    '<details class="expand"><summary>Открой меня</summary>Hello world<div role="button"></div></details>',
  )
})

test('parse gallery with no attributes', () => {
  const result = p.parse('<gallery><img src="https://orbitar.media/img1.jpg" alt="img1"/></gallery>')
  expect(result.text).toEqual('<div class="gallery" ><img src="https://b.orbitar.media/img1.jpg" alt="img1"/></div>')
})

test('parse gallery with all attributes', () => {
  const result = p.parse(
    '<gallery no-arrows no-indicators no-thumbnails auto-play-interval="5"><img src="https://orbitar.media/img1.jpg" alt="img1"/></gallery>',
  )
  expect(result.text).toEqual(
    '<div class="gallery" data-no-arrows data-no-indicators data-no-thumbnails auto-play-interval="5000"><img src="https://b.orbitar.media/img1.jpg" alt="img1"/></div>',
  )
})

test('parse gallery with invalid auto-play-interval', () => {
  const result = p.parse(
    '<gallery auto-play-interval="abc"><img src="https://orbitar.media/img1.jpg" alt="img1"/></gallery>',
  )
  expect(result.text).toEqual('<div class="gallery" ><img src="https://b.orbitar.media/img1.jpg" alt="img1"/></div>')
})

test('parse gallery with nested tags', () => {
  const result = p.parse(
    '<gallery><img src="https://orbitar.media/img1.jpg" alt="img1"/><img src="https://orbitar.media/img2.jpg" alt="img2"/></gallery>',
  )
  expect(result.text).toEqual(
    '<div class="gallery" ><img src="https://b.orbitar.media/img1.jpg" alt="img1"/><img src="https://b.orbitar.media/img2.jpg" alt="img2"/></div>',
  )
})

test('parse gallery with text content drops non-media text', () => {
  const result = p.parse('<gallery>Some text</gallery>')
  expect(result.text).toEqual('<div class="gallery" ></div>')
})

test('parse gallery with invalid child tag', () => {
  const result = p.parse('<gallery><invalid>test</invalid></gallery>')
  expect(result.text).toEqual('<div class="gallery" ></div>')
})

test('parse gallery ignores mentions in text', () => {
  const result = p.parse('<gallery>Hello @username</gallery>')
  expect(result.text).toEqual('<div class="gallery" ></div>')
  expect(result.mentions).toEqual([])
})

test('parse gallery excludes telegram URLs', () => {
  const result = p.parse('<gallery>https://t.me/channel/123</gallery>')
  expect(result.text).toEqual('<div class="gallery" ></div>')
})

test('parse gallery excludes twitter URLs', () => {
  const result = p.parse('<gallery>https://twitter.com/user/status/123456</gallery>')
  expect(result.text).toEqual('<div class="gallery" ></div>')
})

test('parse gallery excludes internal URLs', () => {
  const result = p.parse('<gallery>https://orbitar.space/p123</gallery>')
  expect(result.text).toEqual('<div class="gallery" ></div>')
})

test('parse gallery keeps image URLs', () => {
  const result = p.parse('<gallery>https://example.com/image.jpg</gallery>')
  expect(result.text).toEqual('<div class="gallery" ><img src="https://example.com/image.jpg" alt=""/></div>')
})

test('parse gallery keeps youtube URLs', () => {
  const result = p.parse('<gallery>https://www.youtube.com/watch?v=dQw4w9WgXcQ</gallery>')
  expect(result.text).toContain('class="youtube-embed"')
  expect(result.text).toContain('data-youtube=')
})

test('parse gallery keeps vimeo URLs', () => {
  const result = p.parse('<gallery>https://vimeo.com/123456</gallery>')
  expect(result.text).toContain('class="vimeo-embed"')
  expect(result.text).toContain('data-vimeo=')
})

test('parse gallery keeps coub URLs', () => {
  const result = p.parse('<gallery>https://coub.com/view/abc123</gallery>')
  expect(result.text).toContain('class="coub-embed"')
  expect(result.text).toContain('data-coub=')
})

test('parse gallery keeps video URLs', () => {
  const result = p.parse('<gallery>https://idiod.video/test.mp4</gallery>')
  expect(result.text).toContain('class="video-embed"')
  expect(result.text).toContain('data-video=')
})

test('parse gallery with mixed content keeps only media', () => {
  const result = p.parse('<gallery>Some text https://example.com/image.png @mention https://t.me/channel/123</gallery>')
  expect(result.text).toEqual('<div class="gallery" ><img src="https://example.com/image.png" alt=""/></div>')
  expect(result.mentions).toEqual([])
})

// Edge case tests for gallery parsing
describe('gallery edge cases', () => {
  test('multiple media URLs in one text node', () => {
    const result = p.parse(
      '<gallery>https://example.com/a.jpg https://example.com/b.png https://example.com/c.gif</gallery>',
    )
    expect(result.text).toContain('<img src="https://example.com/a.jpg"')
    expect(result.text).toContain('<img src="https://example.com/b.png"')
    expect(result.text).toContain('<img src="https://example.com/c.gif"')
  })

  test('multiple media URLs with non-media URLs interspersed', () => {
    const result = p.parse('<gallery>https://example.com/a.jpg https://google.com https://example.com/b.png</gallery>')
    expect(result.text).toContain('<img src="https://example.com/a.jpg"')
    expect(result.text).toContain('<img src="https://example.com/b.png"')
    expect(result.text).not.toContain('google.com')
  })

  test('URLs with query parameters', () => {
    const result = p.parse('<gallery>https://example.com/image.jpg?width=100&height=200</gallery>')
    expect(result.text).toContain('<img src="https://example.com/image.jpg?width=100&height=200"')
  })

  test('URLs with fragments', () => {
    const result = p.parse('<gallery>https://example.com/image.png#section</gallery>')
    expect(result.text).toContain('<img src="https://example.com/image.png#section"')
  })

  test('empty gallery', () => {
    const result = p.parse('<gallery></gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('gallery with only whitespace', () => {
    const result = p.parse('<gallery>   \n\t  </gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('gallery with newlines between URLs', () => {
    const result = p.parse('<gallery>https://example.com/a.jpg\nhttps://example.com/b.jpg</gallery>')
    expect(result.text).toContain('<img src="https://example.com/a.jpg"')
    expect(result.text).toContain('<img src="https://example.com/b.jpg"')
  })

  test('nested anchor tag with img is ignored', () => {
    // <a> is not in allowedTags, so the whole subtree is ignored
    const result = p.parse(
      '<gallery><a href="https://example.com"><img src="https://example.com/img.jpg"/></a></gallery>',
    )
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('img tag preserves alt attribute', () => {
    const result = p.parse('<gallery><img src="https://example.com/img.jpg" alt="My description"/></gallery>')
    expect(result.text).toContain('alt="My description"')
  })

  test('img tag alt attribute escapes HTML', () => {
    const result = p.parse(
      '<gallery><img src="https://example.com/img.jpg" alt="<script>alert(1)</script>"/></gallery>',
    )
    expect(result.text).toContain('alt="&lt;script&gt;alert(1)&lt;/script&gt;"')
    expect(result.text).not.toContain('<script>')
  })

  test('img tag alt attribute escapes quotes', () => {
    const result = p.parse('<gallery><img src="https://example.com/img.jpg" alt=\'"><b>XSS</b>\'/></gallery>')
    expect(result.text).toContain('alt="&quot;&gt;&lt;b&gt;XSS&lt;/b&gt;"')
    expect(result.text).not.toContain('<b>XSS</b>')
  })

  test('img tag alt with entity quote gets double-escaped', () => {
    // Input: alt="&quot;" (entity-encoded quote as the value)
    // With decodeEntities: false, the literal &quot; is passed to htmlEscape
    // which escapes the & to &amp;
    const result = p.parse('<img src="https://example.com/img.jpg" alt="&quot;"/>')
    expect(result.text).toContain('alt="&amp;quot;"')
  })

  test('img tag alt with malformed double quote HTML', () => {
    // This is malformed HTML: alt="" followed by "/>
    // htmlparser2 parses this as alt="" (empty)
    const result = p.parse('<img src="https://example.com/img.jpg" alt="""/>')
    expect(result.text).toContain('alt=""')
    expect(result.text).not.toContain('alt="""')
  })

  test('img tag alt with actual quote character via single-quote delimiter', () => {
    // Use single quotes to delimit the attribute, allowing " inside
    const result = p.parse("<img src='https://example.com/img.jpg' alt='\"'/>")
    // The " should be escaped to &quot;
    expect(result.text).toContain('alt="&quot;"')
  })

  test('img tag without src is silently ignored', () => {
    const result = p.parse('<gallery><img alt="no source"/></gallery>')
    // parseImg validates URL, empty URL fails validation -> silently ignored in gallery
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('video tag without src is silently ignored', () => {
    const result = p.parse('<gallery><video></video></gallery>')
    // parseVideo validates URL, empty URL fails validation -> silently ignored in gallery
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('video tag with valid src', () => {
    const result = p.parse('<gallery><video src="https://example.com/video.mp4"/></gallery>')
    expect(result.text).toContain('video')
    expect(result.text).toContain('example.com/video.mp4')
  })

  test('data URLs are rejected', () => {
    const result = p.parse('<gallery>data:image/png;base64,iVBORw0KGgo=</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('blob URLs are rejected', () => {
    const result = p.parse('<gallery>blob:https://example.com/12345</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('file URLs are rejected', () => {
    const result = p.parse('<gallery>file:///etc/passwd.jpg</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('relative URLs are not recognized as URLs', () => {
    const result = p.parse('<gallery>/images/photo.jpg</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('URLs without protocol are not matched', () => {
    const result = p.parse('<gallery>example.com/image.jpg</gallery>')
    // urlRegex requires protocol
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('case sensitivity in extensions - uppercase not matched', () => {
    // processImage regex is case-sensitive, uppercase extensions are not matched
    const result = p.parse('<gallery>https://example.com/IMAGE.JPG</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('case sensitivity in extensions - mixed case not matched', () => {
    // processImage regex is case-sensitive, mixed case extensions are not matched
    const result = p.parse('<gallery>https://example.com/image.JpG</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('youtube shorts URL', () => {
    const result = p.parse('<gallery>https://www.youtube.com/shorts/abc123</gallery>')
    expect(result.text).toContain('youtube-embed')
  })

  test('youtube youtu.be short URL', () => {
    const result = p.parse('<gallery>https://youtu.be/dQw4w9WgXcQ</gallery>')
    expect(result.text).toContain('youtube-embed')
  })

  test('youtube URL with timestamp', () => {
    const result = p.parse('<gallery>https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s</gallery>')
    expect(result.text).toContain('youtube-embed')
    expect(result.text).toContain('start=90')
  })

  test('vimeo URL with timestamp', () => {
    const result = p.parse('<gallery>https://vimeo.com/123456#t=1m30s</gallery>')
    expect(result.text).toContain('vimeo-embed')
  })

  test('orbitar media URL gets CDN rewrite', () => {
    const result = p.parse('<gallery>https://orbitar.media/image.jpg</gallery>')
    expect(result.text).toContain('https://b.orbitar.media/image.jpg')
  })

  test('HTML comment inside gallery is ignored', () => {
    const result = p.parse('<gallery><!-- comment --><img src="https://example.com/img.jpg"/></gallery>')
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
    expect(result.text).not.toContain('comment')
  })

  test('HTML directive inside gallery is ignored', () => {
    const result = p.parse('<gallery><!DOCTYPE html><img src="https://example.com/img.jpg"/></gallery>')
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
    expect(result.text).not.toContain('DOCTYPE')
  })

  test('script tag inside gallery is ignored', () => {
    const result = p.parse('<gallery><script>alert("xss")</script><img src="https://example.com/img.jpg"/></gallery>')
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
    expect(result.text).not.toContain('script')
    expect(result.text).not.toContain('alert')
  })

  test('deeply nested tags are all ignored', () => {
    const result = p.parse('<gallery><div><span><b><img src="https://example.com/img.jpg"/></b></span></div></gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('style tag inside gallery is ignored', () => {
    const result = p.parse('<gallery><style>.x{color:red}</style><img src="https://example.com/img.jpg"/></gallery>')
    expect(result.text).not.toContain('style')
    expect(result.text).not.toContain('color')
  })

  test('text mixed with img tags', () => {
    const result = p.parse(
      '<gallery>prefix text <img src="https://example.com/a.jpg"/> middle text <img src="https://example.com/b.jpg"/> suffix text</gallery>',
    )
    expect(result.text).toContain('<img src="https://example.com/a.jpg"')
    expect(result.text).toContain('<img src="https://example.com/b.jpg"')
    expect(result.text).not.toContain('prefix')
    expect(result.text).not.toContain('middle')
    expect(result.text).not.toContain('suffix')
  })

  test('URL that looks like image but is not (.jpg in path)', () => {
    const result = p.parse('<gallery>https://example.com/jpg/page</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('URL with image extension in query string only', () => {
    const result = p.parse('<gallery>https://example.com/api?file=image.jpg</gallery>')
    // processImage checks pathname, not query
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('multiple youtube videos', () => {
    const result = p.parse('<gallery>https://youtube.com/watch?v=abc123 https://youtube.com/watch?v=def456</gallery>')
    const matches = result.text.match(/youtube-embed/g)
    expect(matches).toHaveLength(2)
  })

  test('mix of different media types', () => {
    const result = p.parse(
      '<gallery>https://example.com/img.jpg https://youtube.com/watch?v=abc https://vimeo.com/123 https://coub.com/view/xyz</gallery>',
    )
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
    expect(result.text).toContain('youtube-embed')
    expect(result.text).toContain('vimeo-embed')
    expect(result.text).toContain('coub-embed')
  })

  test('img tag with extra attributes are sanitized', () => {
    const result = p.parse(
      '<gallery><img src="https://example.com/img.jpg" onclick="alert(1)" onerror="alert(2)" class="foo"/></gallery>',
    )
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
    expect(result.text).not.toContain('onclick')
    expect(result.text).not.toContain('onerror')
    expect(result.text).not.toContain('class="foo"')
  })

  test('webp image format', () => {
    const result = p.parse('<gallery>https://example.com/image.webp</gallery>')
    expect(result.text).toContain('<img src="https://example.com/image.webp"')
  })

  test('svg image format', () => {
    const result = p.parse('<gallery>https://example.com/image.svg</gallery>')
    expect(result.text).toContain('<img src="https://example.com/image.svg"')
  })

  test('webm video format', () => {
    const result = p.parse('<gallery>https://example.com/video.webm</gallery>')
    expect(result.text).toContain('video')
  })

  test('x.com (twitter) URL excluded', () => {
    const result = p.parse('<gallery>https://x.com/user/status/123456</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('telegram.me URL excluded', () => {
    const result = p.parse('<gallery>https://telegram.me/channel/123</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('mention at start of text', () => {
    const result = p.parse('<gallery>@user https://example.com/img.jpg</gallery>')
    expect(result.mentions).toEqual([])
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
  })

  test('mention at end of text', () => {
    const result = p.parse('<gallery>https://example.com/img.jpg @user</gallery>')
    expect(result.mentions).toEqual([])
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
  })

  test('multiple mentions are all ignored', () => {
    const result = p.parse('<gallery>@user1 @user2 @user3 https://example.com/img.jpg</gallery>')
    expect(result.mentions).toEqual([])
  })

  test('mention outside gallery is still captured', () => {
    const result = p.parse('@user <gallery>https://example.com/img.jpg</gallery>')
    expect(result.mentions).toEqual(['user'])
  })

  test('URL with spaces is not matched by URL regex', () => {
    const result = p.parse('<gallery>https://example.com/image with spaces.jpg</gallery>')
    // URL regex doesn't match URLs with spaces - the URL stops at the space
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('unicode in URL', () => {
    const result = p.parse('<gallery>https://example.com/图片.jpg</gallery>')
    expect(result.text).toContain('example.com')
  })

  test('very long URL', () => {
    const longPath = 'a'.repeat(500)
    const result = p.parse(`<gallery>https://example.com/${longPath}.jpg</gallery>`)
    expect(result.text).toContain('<img src=')
  })

  test('gallery attributes are preserved with filtered content', () => {
    const result = p.parse(
      '<gallery no-arrows no-indicators auto-play-interval="5">non-media text https://example.com/img.jpg</gallery>',
    )
    expect(result.text).toContain('data-no-arrows')
    expect(result.text).toContain('data-no-indicators')
    expect(result.text).toContain('auto-play-interval="5000"')
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
  })

  test('plain links are excluded', () => {
    const result = p.parse('<gallery>https://google.com https://github.com/user/repo</gallery>')
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('idiod.video URL', () => {
    const result = p.parse('<gallery>https://idiod.video/abc123.mp4</gallery>')
    expect(result.text).toContain('video-embed')
    expect(result.text).toContain('data-video')
  })

  test('dump.video URL', () => {
    const result = p.parse('<gallery>https://dump.video/i/abc123.mp4</gallery>')
    expect(result.text).toContain('video-embed')
  })

  test('mp4 URL without poster service', () => {
    const result = p.parse('<gallery>https://random-site.com/video.mp4</gallery>')
    // Should still be recognized as video
    expect(result.text).toContain('video')
  })

  test('br tags inside gallery are ignored', () => {
    const result = p.parse('<gallery><br/><img src="https://example.com/img.jpg"/><br/></gallery>')
    expect(result.text).not.toContain('<br')
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
  })

  test('p tags inside gallery are ignored', () => {
    const result = p.parse('<gallery><p><img src="https://example.com/img.jpg"/></p></gallery>')
    // p is not in allowedTags, so the whole p subtree is ignored
    expect(result.text).toEqual('<div class="gallery" ></div>')
  })

  test('URL followed immediately by punctuation', () => {
    const result = p.parse('<gallery>https://example.com/img.jpg.</gallery>')
    // The trailing dot might affect URL parsing
    expect(result.text).toContain('example.com/img.jpg')
  })

  test('URL in parentheses', () => {
    const result = p.parse('<gallery>(https://example.com/img.jpg)</gallery>')
    expect(result.text).toContain('example.com/img.jpg')
  })

  test('multiple img tags in sequence', () => {
    const result = p.parse(
      '<gallery><img src="https://example.com/1.jpg"/><img src="https://example.com/2.jpg"/><img src="https://example.com/3.jpg"/></gallery>',
    )
    expect(result.text).toContain('https://example.com/1.jpg')
    expect(result.text).toContain('https://example.com/2.jpg')
    expect(result.text).toContain('https://example.com/3.jpg')
  })

  // Uppercase tag tests - htmlparser2 normalizes tag names to lowercase
  test('uppercase GALLERY tag works', () => {
    const result = p.parse('<GALLERY><img src="https://example.com/img.jpg"/></GALLERY>')
    expect(result.text).toContain('<div class="gallery"')
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
  })

  test('uppercase IMG tag inside gallery works', () => {
    const result = p.parse('<gallery><IMG src="https://example.com/img.jpg"/></gallery>')
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
  })

  test('uppercase VIDEO tag inside gallery works', () => {
    const result = p.parse('<gallery><VIDEO src="https://example.com/video.mp4"/></gallery>')
    expect(result.text).toContain('video')
    expect(result.text).toContain('example.com/video.mp4')
  })

  test('mixed case Gallery tag works', () => {
    const result = p.parse('<Gallery><img src="https://example.com/img.jpg"/></Gallery>')
    expect(result.text).toContain('<div class="gallery"')
    expect(result.text).toContain('<img src="https://example.com/img.jpg"')
  })
})

test('parse img alt attribute for double escape', () => {
  // alt contains HTML special chars
  const result = p.parse('<img src="https://orbitar.media/img1.jpg" alt="&lt;test&gt; &amp; &quot;"/>')
  expect(result.text).toEqual(
    '<img src="https://b.orbitar.media/img1.jpg" alt="&amp;lt;test&amp;gt; &amp;amp; &amp;quot;"/>',
  )
})

test('parse img alt attribute with quotes', () => {
  const result = p.parse('<img src="https://orbitar.media/img1.jpg" alt="a &quot;quote&quot;"/>')
  expect(result.text).toEqual('<img src="https://b.orbitar.media/img1.jpg" alt="a &amp;quot;quote&amp;quot;"/>')
})

test('parse img alt attribute vulnerable with single quote', () => {
  const result = p.parse('<img src="https://example.com/pic.jpg" alt=\'"><b>INJECTED</b>\'>')
  expect(result.text).toEqual('<img src="https://example.com/pic.jpg" alt="&quot;&gt;&lt;b&gt;INJECTED&lt;/b&gt;"/>')
})

test('parse img alt attribute with single quote', () => {
  const result = p.parse('<img src="https://orbitar.media/img1.jpg" alt="it\'s a test"/>')
  expect(result.text).toEqual('<img src="https://b.orbitar.media/img1.jpg" alt="it&#39;s a test"/>')
})

test('parse img with missing alt attribute', () => {
  const result = p.parse('<img src="https://orbitar.media/img1.jpg"/>')
  expect(result.text).toEqual('<img src="https://b.orbitar.media/img1.jpg" alt=""/>')
})

test('parse secret mailbox with valid secret attribute', () => {
  const result = p.parse('<mailbox secret="12345">Hello</mailbox>')
  expect(result.text).toEqual(
    '<span class="i i-mailbox-secure secret-mailbox" data-secret="12345" data-raw-text="SGVsbG8=">Hello</span>',
  )
})

test('parse secret mailbox without secret attribute', () => {
  const result = p.parse('<mailbox>Hello</mailbox>')
  expect(result.text).toEqual('&lt;mailbox&gt;Hello&lt;/mailbox&gt;')
})

test('parse secret mailbox with empty secret attribute', () => {
  const result = p.parse('<mailbox secret="">Hello</mailbox>')
  expect(result.text).toEqual('&lt;mailbox secret=&quot;&quot;&gt;Hello&lt;/mailbox&gt;')
})

test('parse secret mailbox with nested tags', () => {
  const result = p.parse('<mailbox secret="12345"><b>Hello</b></mailbox>')
  expect(result.text).toEqual(
    '<span class="i i-mailbox-secure secret-mailbox" data-secret="12345" data-raw-text="SGVsbG8="><b>Hello</b></span>',
  )
})

test('parse secret mailbox with nested invalid tags', () => {
  const result = p.parse('<mailbox secret="12345"><invalid>Hello</invalid></mailbox>')
  expect(result.text).toEqual(
    '<span class="i i-mailbox-secure secret-mailbox" data-secret="12345" data-raw-text="SGVsbG8=">&lt;invalid&gt;Hello&lt;/invalid&gt;</span>',
  )
})

test('parse secret mailbox with Russian text', () => {
  const result = p.parse('<mailbox secret="12345">Привет</mailbox>')
  expect(result.text).toEqual(
    '<span class="i i-mailbox-secure secret-mailbox" data-secret="12345" data-raw-text="0J/RgNC40LLQtdGC">Привет</span>',
  )
})

test('parse secret mailbox with nested mailbox', () => {
  const result = p.parse('<mailbox secret="12345"><mailbox secret="67890">Hello</mailbox></mailbox>')
  expect(result.text).toEqual(
    '<span class="i i-mailbox-secure secret-mailbox" data-secret="12345" data-raw-text="SGVsbG8=">Hello</span>',
  )
})

test('disallowed tags nesting', () => {
  // pre cannot be inside a
  expect(p.parse('<a href="https://test.com"><pre>test</pre></a>').text).toEqual(
    '<a href="https://test.com" target="_blank">test</a>',
  )

  // a cannot be inside a
  expect(p.parse('<a href="https://test.com"><a href="https://test2.com">test</a></a>').text).toEqual(
    '<a href="https://test.com" target="_blank">test</a>',
  )

  // mailbox cannot be inside a, mailbox, or mail
  expect(p.parse('<a href="https://test.com"><mailbox secret="12345">test</mailbox></a>').text).toEqual(
    '<a href="https://test.com" target="_blank">test</a>',
  )

  expect(p.parse('<mailbox secret="12345"><mailbox secret="67890">test</mailbox></mailbox>').text).toEqual(
    '<span class="i i-mailbox-secure secret-mailbox" data-secret="12345" data-raw-text="dGVzdA==">test</span>',
  )

  expect(p.parse('<mail secret="12345"><mailbox secret="67890">test</mailbox></mail>').text).toEqual(
    '<span class="i i-mail-secure secret-mail" data-secret="12345">test</span>',
  )

  // mail cannot be inside a, mailbox, or mail
  expect(p.parse('<mail secret="12345"><mail secret="67890">test</mail></mail>').text).toEqual(
    '<span class="i i-mail-secure secret-mail" data-secret="12345">test</span>',
  )

  // app cannot be inside a, mailbox, or mail
  expect(p.parse('<a href="https://test.com"><app>test-client-id</app></a>').text).toEqual(
    '<a href="https://test.com" target="_blank">test-client-id</a>',
  )

  // expand can be nested in expand
  expect(p.parse('<expand title="outer"><expand title="inner">test</expand></expand>').text).toEqual(
    '<details class="expand"><summary>outer</summary><details class="expand"><summary>inner</summary>test<div role="button"></div></details><div role="button"></div></details>',
  )

  // expand cannot be inside a
  expect(p.parse('<a href="https://test.com"><expand title="test">test</expand></a>').text).toEqual(
    '<a href="https://test.com" target="_blank">test</a>',
  )
})

test('base64 validation', () => {
  expect(TheParser.isValidBase64('')).toEqual(true)
  expect(TheParser.isValidBase64('SGVsbG8')).toEqual(true)
  expect(TheParser.isValidBase64('SGVsbG8=')).toEqual(true)
  expect(TheParser.isValidBase64('SGVsbG8==')).toEqual(true)
  expect(TheParser.isValidBase64('SGVsbG8===')).toEqual(true)

  expect(TheParser.isValidBase64('=SGVsbG8')).toEqual(false)
  expect(TheParser.isValidBase64('"SGVsbG8=')).toEqual(false)
})

describe('parsePoll', () => {
  test('valid poll ID', () => {
    const result = p.parse('<poll>123</poll>')
    expect(result.text).toEqual('<div class="poll" data-poll-id="123"></div>')
  })

  test('invalid poll ID - non-numeric', () => {
    const result = p.parse('<poll>abc</poll>')
    expect(result.text).toEqual('&lt;poll&gt;abc&lt;/poll&gt;')
  })

  test('invalid poll ID - negative number', () => {
    const result = p.parse('<poll>-123</poll>')
    expect(result.text).toEqual('&lt;poll&gt;-123&lt;/poll&gt;')
  })

  test('invalid poll ID - zero', () => {
    const result = p.parse('<poll>0</poll>')
    expect(result.text).toEqual('&lt;poll&gt;0&lt;/poll&gt;')
  })

  test('invalid poll ID - decimal number', () => {
    const result = p.parse('<poll>123.45</poll>')
    expect(result.text).toEqual('&lt;poll&gt;123.45&lt;/poll&gt;')
  })

  test('invalid poll ID - empty', () => {
    const result = p.parse('<poll></poll>')
    expect(result.text).toEqual('&lt;poll/&gt;&lt;/poll&gt;')
  })

  test('poll tag with nested content is treated as text', () => {
    const result = p.parse('<poll><b>123</b></poll>')
    expect(result.text).toEqual('&lt;poll&gt;<b>123</b>&lt;/poll&gt;')
  })

  test('poll cannot be inside a tag', () => {
    const result = p.parse('<a href="https://test.com"><poll>123</poll></a>')
    expect(result.text).toEqual('<a href="https://test.com" target="_blank">123</a>')
  })
})

describe('processInternalUrl', () => {
  test('valid internal url', () => {
    const url = 'https://orbitar.local/s/site/p123'
    const result = p.processInternalUrl(url)
    expect(result).toEqual(
      '<span role="button" class="expand-button i i-expand" data-post-id="123"></span><a href="https://orbitar.local/s/site/p123" target="_blank">https://orbitar.local/s/site/p123</a>',
    )
  })

  test('invalid internal url', () => {
    const url = 'https://invalid.com/s/site/p123'
    const result = p.processInternalUrl(url)
    expect(result).toEqual(false)
  })

  test('internal url with comment id', () => {
    const url = 'https://orbitar.local/s/site/p123#456'
    const result = p.processInternalUrl(url)
    expect(result).toEqual(
      '<span role="button" class="expand-button i i-expand" data-post-id="123" data-comment-id="456"></span><a href="https://orbitar.local/s/site/p123#456" target="_blank">https://orbitar.local/s/site/p123#456</a>',
    )
  })

  test('internal url without comment id', () => {
    const url = 'https://orbitar.local/s/site/p123'
    const result = p.processInternalUrl(url)
    expect(result).toEqual(
      '<span role="button" class="expand-button i i-expand" data-post-id="123"></span><a href="https://orbitar.local/s/site/p123" target="_blank">https://orbitar.local/s/site/p123</a>',
    )
  })
})

describe('telegram parsing', () => {
  test('valid telegram url with t.me domain', () => {
    const result = p.parse('https://t.me/channel/123')
    expect(result.text).toEqual(
      '<span role="button" class="expand-button i i-expand" data-telegram-url="https://t.me/channel/123"></span><a href="https://t.me/channel/123" target="_blank">https://t.me/channel/123</a>',
    )
  })

  test('valid telegram url with telegram.me domain', () => {
    const result = p.parse('https://telegram.me/channel/123')
    expect(result.text).toEqual(
      '<span role="button" class="expand-button i i-expand" data-telegram-url="https://t.me/channel/123"></span><a href="https://t.me/channel/123" target="_blank">https://t.me/channel/123</a>',
    )
  })

  test('invalid telegram url with wrong domain', () => {
    const result = p.parse('https://example.com/channel/123')
    expect(result.text).toEqual(
      '<a href="https://example.com/channel/123" target="_blank">https://example.com/channel/123</a>',
    )
  })

  test('invalid telegram url with wrong path format', () => {
    const result = p.parse('https://t.me/channel')
    expect(result.text).toEqual('<a href="https://t.me/channel" target="_blank">https://t.me/channel</a>')
  })

  test('invalid telegram url with non-numeric post id', () => {
    const result = p.parse('https://t.me/channel/abc')
    expect(result.text).toEqual('<a href="https://t.me/channel/abc" target="_blank">https://t.me/channel/abc</a>')
  })

  test('telegram url parsing in text content', () => {
    const result = p.parse('Check out this post: https://t.me/channel/123')
    expect(result.text).toContain('data-telegram-url="https://t.me/channel/123"')
    expect(result.text).toContain('class="expand-button i i-expand"')
  })

  test('telegram links in a tag should be rendered with expand button', () => {
    const result = p.parse('<a href="https://t.me/channel/123">Telegram post</a>')
    expect(result.text).toEqual(
      '<span role="button" class="expand-button i i-expand" data-telegram-url="https://t.me/channel/123"></span><a href="https://t.me/channel/123" target="_blank">Telegram post</a>',
    )
  })
})

describe('twitter parsing', () => {
  test('valid twitter url with twitter.com domain', () => {
    const result = p.parse('https://twitter.com/user/status/123')
    expect(result.text).toEqual(
      '<span role="button" class="expand-button i i-expand" data-twitter-url="https://twitter.com/user/status/123"></span><a href="https://twitter.com/user/status/123" target="_blank">https://twitter.com/user/status/123</a>',
    )
  })

  test('valid twitter url with x.com domain', () => {
    const result = p.parse('https://x.com/user/status/123')
    expect(result.text).toEqual(
      '<span role="button" class="expand-button i i-expand" data-twitter-url="https://twitter.com/user/status/123"></span><a href="https://twitter.com/user/status/123" target="_blank">https://twitter.com/user/status/123</a>',
    )
  })

  test('invalid twitter url with wrong domain', () => {
    const result = p.parse('https://example.com/user/status/123')
    expect(result.text).toEqual(
      '<a href="https://example.com/user/status/123" target="_blank">https://example.com/user/status/123</a>',
    )
  })

  test('invalid twitter url with wrong path format', () => {
    const result = p.parse('https://twitter.com/user')
    expect(result.text).toEqual('<a href="https://twitter.com/user" target="_blank">https://twitter.com/user</a>')
  })

  test('twitter url parsing in text content', () => {
    const result = p.parse('Check: https://twitter.com/user/status/123')
    expect(result.text).toContain('data-twitter-url="https://twitter.com/user/status/123"')
    expect(result.text).toContain('class="expand-button i i-expand"')
  })

  test('twitter links in a tag should be rendered with expand button', () => {
    const result = p.parse('<a href="https://twitter.com/user/status/123">Tweet</a>')
    expect(result.text).toEqual(
      '<span role="button" class="expand-button i i-expand" data-twitter-url="https://twitter.com/user/status/123"></span><a href="https://twitter.com/user/status/123" target="_blank">Tweet</a>',
    )
  })
})
