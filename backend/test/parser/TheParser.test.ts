
import TheParser from "../../src/parser/TheParser";

const p = new TheParser({
    url: 'https://orbitar.media',
    dimsAesKey: 'k7DG2CekzdUfckbr7ay9PESLvDPBQf9S' // note: random key, don't use it for anything else!
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
    expect(p.parse('https://orbitar.media/2CoP3GlQbjzFhGkh1jkObDwsgg1NsmV1FP.mp4').text).toEqual(
        `<a class="video-embed" href="https://orbitar.media/2CoP3GlQbjzFhGkh1jkObDwsgg1NsmV1FP.mp4" `+
        `target="_blank"><img src="https://orbitar.media/preview/2CoP3GlQbjzFhGkh1jkObDwsgg1NsmV1FP.mp4" `+
        `width="123" height="456" `+
        `alt="" data-video="https://orbitar.media/2CoP3GlQbjzFhGkh1jkObDwsgg1NsmV1FP.mp4/raw"/></a>`
    );
});

test('mp4 video element', () => {
    expect(p.parse('<video src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4">').text).toEqual(
        `<video  preload="metadata" controls="" width="500"><source src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4" type="video/mp4"></video>`
    );
});

test('orbitar image link', () => {
    expect(p.parse('https://orbitar.media/2BzdP5FgGRLHrxhLzLZIrHHAcrf8TWlCef.jpg').text).toEqual(
        `<img width="123" height="456" src="https://orbitar.media/2BzdP5FgGRLHrxhLzLZIrHHAcrf8TWlCef.jpg" alt=""/>`
    );
});

test('orbitar image', () => {
    expect(p.parse('<img src="https://orbitar.media/2BzdP5FgGRLHrxhLzLZIrHHAcrf8TWlCef.jpg">').text).toEqual(
        `<img width="123" height="456" src="https://orbitar.media/2BzdP5FgGRLHrxhLzLZIrHHAcrf8TWlCef.jpg" alt=""/>`
    );
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

test('metadata decrypt', () => {
    expect(
        p.extractMetadata('/2BzpgpcfkWRAzyTQizXMcLSXBbahQ5e1Xa.jpg')
    ).toEqual({
        width: 123,
        height: 456,
        ext: 'jpg'
    });

    // mismatched extensnion
    expect(p.extractMetadata('/2BzpgpcfkWRAzyTQizXMcLSXBbahQ5e1Xa.gif')).toBeNull();
});