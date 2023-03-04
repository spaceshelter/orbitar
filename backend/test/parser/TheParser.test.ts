
import TheParser from "../../src/parser/TheParser";

const p = new TheParser({
    url: 'https://orbitar.media',
    dimsAesKey: ''
});

test('parse A tag', () => {
    // already encoded
    expect(
        p.parse('<a href="https://ru.wikipedia.org/wiki/%D0%A1%D0%BB%D0%B0%D0%B2%D0%B0_%D0%A3%D0%BA%D1%80%D0%B0%D0%B8%D0%BD%D0%B5">тест</a>').text
    ).toEqual('<a href="https://ru.wikipedia.org/wiki/%D0%A1%D0%BB%D0%B0%D0%B2%D0%B0_%D0%A3%D0%BA%D1%80%D0%B0%D0%B8%D0%BD%D0%B5" target="_blank">тест</a>');

    // should be encoded
    expect(
        p.parse('<a href="https://ru.wikipedia.org/wiki/42_Дракона_b">тест</a>').text
    ).toEqual('<a href="https://ru.wikipedia.org/wiki/42_%D0%94%D1%80%D0%B0%D0%BA%D0%BE%D0%BD%D0%B0_b" target="_blank">тест</a>');

    // invalid url in A tag
    expect(
        p.parse('<a href="http://1.1.1.1.1">t</a>').text
    ).toEqual('&lt;a href=&quot;http://1.1.1.1.1&quot;&gt;t&lt;/a&gt;');

    // invalid url in A tag that is valid if escaped
    expect(
        p.parse('<a href="http://1.1.1.1/ 1">t</a>').text
    ).toEqual('<a href="http://1.1.1.1/%201" target="_blank">t</a>');
});

test('detect url in text', () => {
    expect(
        p.parse('Hello, \n' +
            'http://hello.world test\n' +
            'the end'
        ).text
    ).toEqual(
        'Hello, <br />\n' +
        '<a href="http://hello.world" target="_blank">http://hello.world</a> test<br />\n' +
        'the end'
    );
});

test('return valid youtube url', () => {
  expect(
      p.parse('https://www.youtube.com/watch?v=aboZctrHfK8'
      ).text
  ).toEqual(
      `<a class="youtube-embed" href="https://www.youtube.com/watch?v=aboZctrHfK8" target="_blank"><img src="https://img.youtube.com/vi/aboZctrHfK8/0.jpg" alt="" data-youtube="https://www.youtube.com/embed/aboZctrHfK8"/></a>`
  );
});

test('idiod video embed', () => {
    expect(p.parse('https://idiod.video/8feuw2.mp4').text).toEqual(
        `<a class="video-embed" href="https://idiod.video/8feuw2.mp4" target="_blank"><img src="https://idiod.video/preview/8feuw2.mp4" alt="" data-video="https://idiod.video/8feuw2.mp4"/></a>`
    );
});

test('orbitar video embed', () => {
    expect(p.parse('https://orbitar.media/8feuw2.mp4').text).toEqual(
        `<a class="video-embed" href="https://orbitar.media/8feuw2.mp4" target="_blank"><img src="https://orbitar.media/preview/8feuw2.mp4" alt="" data-video="https://orbitar.media/8feuw2.mp4/raw"/></a>`
    );
});

test('mp4 video element', () => {
    expect(p.parse('<video src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4">').text).toEqual(
        `<video  preload="metadata" controls="" width="500"><source src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4" type="video/mp4"></video>`
    );
});

test('strip leading and trailing non-printable chars', () => {
    const orig = Buffer.from([0x00, 0x01, 0x20, 0x34, 0x32, 0x16, 0x20, 0x0D, 0x0A]).toString('utf8');
    const parsed = p.parse(orig).text;
    expect(parsed).toEqual('42');
});

test('remove line breaks at the beginning and the end', () => {
    expect(
        p.parse('Hello, \n' +
            'world'
        ).text
    ).toEqual(
        'Hello, <br />\n' +
        'world'
    );

    expect(
        p.parse('\nHello, \n' +
            'world' + '\n'
        ).text).toEqual(
        'Hello, <br />\n' +
        'world'
    );

    expect(
        p.parse('\n\n\nHello, \n' +
            'world' + '\n\n\n'
        ).text).toEqual(
        'Hello, <br />\n' +
        'world'
    );
});

test('remove extra line break after blockquote tag', () => {
    expect(
        p.parse('<blockquote>Hello</blockquote>\nworld'
        ).text
    ).toEqual(
        '<blockquote>Hello</blockquote>world'
    );

    expect(
        p.parse('<blockquote>Hello</blockquote>\n\nworld'
        ).text
    ).toEqual(
        '<blockquote>Hello</blockquote><br />\nworld'
    );

    expect(
        p.parse('<blockquote>Hello</blockquote>\n\n\nworld'
        ).text
    ).toEqual(
        '<blockquote>Hello</blockquote><br />\nworld'
    );

    expect(
        p.parse('<blockquote>Hello\n<blockquote>world</blockquote>\n</blockquote>test').text
    ).toEqual(
        '<blockquote>Hello<br />\n<blockquote>world</blockquote></blockquote>test'
    );
});

test('unwrap nested links', () => {
    expect(
        p.parse('<a href="https://test.com"><a href="https://test.com">test</a></a>').text
    ).toEqual(
        '<a href="https://test.com" target="_blank">test</a>'
    );

    expect(
        p.parse('<a href="https://test.com">https://test2.com</a> test').text
    ).toEqual(
        '<a href="https://test2.com" target="_blank">https://test2.com</a> test'
    );
});

test('mentions', () => {
    // `<a href="${encodeURI(`/u/${token.data}`)}" target="_blank" class="mention">${htmlEscape(token.data)}</a>`;

    expect(
        p.parse('@test').text
    ).toEqual(
        '<a href="/u/test" target="_blank" class="mention">test</a>'
    );

    expect(
        p.parse('@test test').text
    ).toEqual(
        '<a href="/u/test" target="_blank" class="mention">test</a> test'
    );

    expect(
        p.parse('@test test @test').text
    ).toEqual(
        '<a href="/u/test" target="_blank" class="mention">test</a> test <a href="/u/test" target="_blank" class="mention">test</a>'
    );

    // urls, text, mentions
    expect(
        p.parse('https://test.com @test test').text
    ).toEqual(
        '<a href="https://test.com" target="_blank">https://test.com</a> <a href="/u/test" target="_blank" class="mention">test</a> test'
    );

    // mentions in links take precedence
    expect(
        p.parse('<a href="https://test.com">@test</a>').text
    ).toEqual(
        '<a href="/u/test" target="_blank" class="mention">test</a>'
    );
});

test('parse html comment', () => {
    // returns escaped html comment as text
    expect(
        p.parse('<!-- test -->').text
    ).toEqual('&lt;!-- test --&gt;');

    expect(
        p.parse('<!-- test -->test').text
    ).toEqual('&lt;!-- test --&gt;test');

    expect(
        p.parse('test<!-- test -->').text
    ).toEqual('test&lt;!-- test --&gt;');

    expect(
        p.parse('test<!-- test -->test').text
    ).toEqual('test&lt;!-- test --&gt;test');

    expect(
        p.parse('test<!-- test -->test<!-- test -->test').text
    ).toEqual('test&lt;!-- test --&gt;test&lt;!-- test --&gt;test');

});

test('parse html comment with html tags', () => {
    expect(
        p.parse('<!-- <a href="http://test.com">test</a> -->').text
    ).toEqual('&lt;!-- &lt;a href=&quot;http://test.com&quot;&gt;test&lt;/a&gt; --&gt;');
});

test('parse html directive', () => {
    // returns escaped html directive as text
    expect(
        p.parse('<!DOCTYPE html>').text
    ).toEqual('&lt;!DOCTYPE html&gt;');

    expect(
        p.parse('<!DOCTYPE html>test').text
    ).toEqual('&lt;!DOCTYPE html&gt;test');

    expect(
        p.parse('test<!DOCTYPE html>').text
    ).toEqual('test&lt;!DOCTYPE html&gt;');

    expect(
        p.parse('test<!DOCTYPE html>test').text
    ).toEqual('test&lt;!DOCTYPE html&gt;test');

    expect(
        p.parse('test<!DOCTYPE html>test<!DOCTYPE html>test').text
    ).toEqual('test&lt;!DOCTYPE html&gt;test&lt;!DOCTYPE html&gt;test');

    expect(
        p.parse('<?xml version="1.0" encoding="UTF-8"?>').text
    ).toEqual('&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?&gt;');

    expect(
        p.parse('<?xml version="1.0" encoding="UTF-8"?>test').text
    ).toEqual('&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?&gt;test');

    expect(
        p.parse('test<?xml version="1.0" encoding="UTF-8"?>').text
    ).toEqual('test&lt;?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?&gt;');

});