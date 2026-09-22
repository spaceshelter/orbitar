import { mentionsRegex, urlRegex, urlRegexExact } from '../../src/parser/regexprs'

test('valid ULR parsing', () => {
  const validUrls = [
    'http://foo.com/blah_blah',
    'http://foo.com/blah_blah/',
    'http://foo.com/blah_blah_(wikipedia)',
    'http://foo.com/blah_blah_(wikipedia)_(again)',
    'http://www.example.com/wpstyle/?p=364',
    'https://www.example.com/foo/?bar=baz&inga=42&quux',
    'http://✪df.ws/123',
    'http://userid:password@example.com:8080',
    'http://userid:password@example.com:8080/',
    'http://userid@example.com',
    'http://userid@example.com/',
    'http://userid@example.com:8080',
    'http://userid@example.com:8080/',
    'http://userid:password@example.com',
    'http://userid:password@example.com/',
    'http://142.42.1.1/',
    'http://142.42.1.1:8080/',
    'http://➡.ws/䨹',
    'http://⌘.ws',
    'http://⌘.ws/',
    'http://foo.com/blah_(wikipedia)#cite-1',
    'http://foo.com/blah_(wikipedia)_blah#cite-1',
    'http://foo.com/unicode_(✪)_in_parens',
    'http://foo.com/(something)?after=parens',
    'http://☺.damowmow.com/',
    'http://code.google.com/events/#&product=browser',
    'http://j.mp',
    'ftp://foo.bar/baz',
    'http://foo.bar/?q=Test%20URL-encoded%20stuff',
    'http://مثال.إختبار',
    'http://例子.测试',
    'http://उदाहरण.परीक्षा',
    "http://-.~_!$&'()*+,;=:%40:80%2f::::::@example.com",
    'http://1337.net',
    'http://a.b-c.de',
    'http://223.255.255.254',
    'https://foo_bar.example.com/',
  ]
  for (const url of validUrls) {
    expect(url).toMatch(urlRegexExact)
  }
})

test('invalid ULR parsing', () => {
  const invalidUrls = [
    'http://',
    'http://.',
    'http://..',
    'http://../',
    'http://?',
    'http://??',
    'http://??/',
    'http://#',
    'http://##',
    'http://##/',
    'http://foo.bar?q=Spaces should be encoded',
    '//',
    '//a',
    '///a',
    '///',
    'http:///a',
    'foo.com',
    'rdar://1234',
    'h://test',
    'http:// shouldfail.com',
    ':// should fail',
    'http://foo.bar/foo(bar)baz quux',
    'ftps://foo.bar/',
    'http://-error-.invalid/',
    // 'http://a.b--c.de/',
    'http://-a.b.co',
    'http://a.b-.co',
    'http://0.0.0.0',
    'http://10.1.1.0',
    'http://10.1.1.255',
    'http://224.1.1.1',
    'http://1.1.1.1.1',
    'http://123.123.123',
    'http://3628126748',
    'http://.www.foo.bar/',
    // 'http://www.foo.bar./',
    'http://.www.foo.bar./',
    'http://10.1.1.1',
    'http://10.1.1.254',
  ]
  for (const url of invalidUrls) {
    expect(url).not.toMatch(urlRegexExact)
  }
})

test('URL extraction', () => {
  // baseline
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('http://test.com')[0]).toEqual('http://test.com')

  // start of the url must be clearly separated from the text
  urlRegex.lastIndex = 0
  expect(urlRegex.test('ahttp://test.com')).toBe(false)

  urlRegex.lastIndex = 0
  expect(urlRegex.exec('.http://test.com?q=123 as')[0]).toEqual('http://test.com?q=123')

  urlRegex.lastIndex = 0
  expect(urlRegex.exec('a http://test.com?q=123 as')[0]).toEqual('http://test.com?q=123')

  // some symbols are explicitly excluded from the resource part of the url (like .,! brackets, etc)
  // but only when they are not at the end of the url
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('(http://test.com?q=123)')[0]).toEqual('http://test.com?q=123')
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('[http://test.com?q=123]')[0]).toEqual('http://test.com?q=123')
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('http://test.com?q=123,')[0]).toEqual('http://test.com?q=123')

  // when punctuation symbols are in the middle of the url, they are not considered as part of the url:
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('http://test.com?q=123,blabla')[0]).toEqual('http://test.com?q=123,blabla')
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('https://i.imgur.com/LEv7f25.mp4')[0]).toEqual('https://i.imgur.com/LEv7f25.mp4')
})

test('URL extraction: balanced parentheses in the resource path', () => {
  // balanced parens are part of the url: wikipedia disambiguation titles, DOI/PII identifiers
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('https://en.wikipedia.org/wiki/Hill_Valley_(Back_to_the_Future)')[0]).toEqual(
    'https://en.wikipedia.org/wiki/Hill_Valley_(Back_to_the_Future)',
  )
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('https://www.cell.com/neuron/fulltext/S0896-6273(21)00423-2')[0]).toEqual(
    'https://www.cell.com/neuron/fulltext/S0896-6273(21)00423-2',
  )
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('http://foo.com/blah_(wikipedia)_blah#cite-1')[0]).toEqual(
    'http://foo.com/blah_(wikipedia)_blah#cite-1',
  )
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('http://foo.com/(something)?after=parens')[0]).toEqual('http://foo.com/(something)?after=parens')

  // ...but a url wrapped in prose parentheses still stops before the closing one,
  // even when its own path ends with a parenthesised group
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('see (http://test.com/a) after')[0]).toEqual('http://test.com/a')
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('(https://ru.wikipedia.org/wiki/Test_(meaning)) tail')[0]).toEqual(
    'https://ru.wikipedia.org/wiki/Test_(meaning)',
  )

  // an unbalanced opening paren is not consumed
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('http://test.com/foo(bar')[0]).toEqual('http://test.com/foo')

  // only one nesting level is supported, same as other linkifiers
  urlRegex.lastIndex = 0
  expect(urlRegex.exec('http://example.com/x_(y_(z))')[0]).toEqual('http://example.com/x_')
})

test('mention extraction', () => {
  // baseline
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('@test')[0]).toEqual('@test')

  // start of the mention must be clearly separated from the text
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.test('a@test')).toBe(false)

  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('.@test as')[0]).toEqual('@test')

  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('a @test as')[0]).toEqual('@test')

  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('(@test)')[0]).toEqual('@test')

  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('[@test]')[0]).toEqual('@test')

  // ...but a slash is a path separator, not a separator between words: a
  // mention may not start inside a URL path (`orbitar.space/@test` is a
  // profile URL, not a mention of `test`).
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.test('orbitar.space/@test')).toBe(false)

  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.test('docs/@test for details')).toBe(false)

  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.test('/@test')).toBe(false)

  // the slash is the only added exclusion: one space away it still matches
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('orbitar.space/ @test')[0]).toEqual('@test')

  // cyrillic
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('@тест')[0]).toEqual('@тест')

  //case insensitive
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('@TEST')[0]).toEqual('@TEST')

  // cyrillic case insensitive
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('@ТЕСТ')[0]).toEqual('@ТЕСТ')

  // numbers
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('@test123')[0]).toEqual('@test123')

  // underscore
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('@test_123')[0]).toEqual('@test_123')

  // dash
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('@test-123')[0]).toEqual('@test-123')

  // dot delimiter
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('@test.123')[0]).toEqual('@test')

  // first group
  mentionsRegex.lastIndex = 0
  expect(mentionsRegex.exec('@test.123')[1]).toEqual('test')
})
