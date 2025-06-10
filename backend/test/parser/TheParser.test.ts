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
