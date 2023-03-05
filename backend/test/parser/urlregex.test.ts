import {urlRegex, urlRegexExact} from "../../src/parser/urlregex";

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
        'http://-.~_!$&\'()*+,;=:%40:80%2f::::::@example.com',
        'http://1337.net',
        'http://a.b-c.de',
        'http://223.255.255.254',
        'https://foo_bar.example.com/'
    ];
    for (const url of validUrls) {
        expect(url).toMatch(urlRegexExact);
    }
});

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
        'http://10.1.1.254'
    ];
    for (const url of invalidUrls) {
        expect(url).not.toMatch(urlRegexExact);
    }
});

test('URL extraction', () => {
    // baseline
    urlRegex.lastIndex = 0;
    expect(urlRegex.exec("http://test.com")[0]).toEqual("http://test.com");

    // start of the url must be clearly separated from the text
    urlRegex.lastIndex = 0;
    expect(urlRegex.test("ahttp://test.com")).toBe(false);

    urlRegex.lastIndex = 0;
    expect(urlRegex.exec(".http://test.com?q=123 as")[0]).toEqual("http://test.com?q=123");

    urlRegex.lastIndex = 0;
    expect(urlRegex.exec("a http://test.com?q=123 as")[0]).toEqual("http://test.com?q=123");

    // some symbols are explicitly excluded from the resource part of the url (like .,! brackets, etc)
    // but only when they are not at the end of the url
    urlRegex.lastIndex = 0;
    expect(urlRegex.exec("(http://test.com?q=123)")[0]).toEqual("http://test.com?q=123");
    urlRegex.lastIndex = 0;
    expect(urlRegex.exec("[http://test.com?q=123]")[0]).toEqual("http://test.com?q=123");
    urlRegex.lastIndex = 0;
    expect(urlRegex.exec("http://test.com?q=123,")[0]).toEqual("http://test.com?q=123");

    // when punctuation symbols are in the middle of the url, they are not considered as part of the url:
    urlRegex.lastIndex = 0;
    expect(urlRegex.exec("http://test.com?q=123,blabla")[0]).toEqual("http://test.com?q=123,blabla");
    urlRegex.lastIndex = 0;
    expect(urlRegex.exec("https://i.imgur.com/LEv7f25.mp4")[0]).toEqual("https://i.imgur.com/LEv7f25.mp4");
});
