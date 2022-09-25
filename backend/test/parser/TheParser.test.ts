
import TheParser from "../../src/parser/TheParser";

test('parse A tag', () => {
    const p = new TheParser();

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
    const p = new TheParser();

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
  const p = new TheParser();

  expect(
      p.parse('https://www.youtube.com/watch?v=aboZctrHfK8'
      ).text
  ).toEqual(
      `<iframe width=\"500\" height=\"282\" src=\"https://www.youtube.com/embed/aboZctrHfK8\" allowfullscreen frameborder=\"0\"></iframe>`
  );
});

test('remove line breaks at the beginning and the end', () => {
    const p = new TheParser();

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
    const p = new TheParser();

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

