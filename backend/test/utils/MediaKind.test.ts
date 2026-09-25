import { getMediaKind } from '../../src/utils/MediaKind'

// Markup as TheParser renders it: plain images, a bare <video>, and the preview
// images it wraps in <a class="…-embed"> for YouTube, Vimeo, Coub and hosted video.
const image = (src: string) => `<img src="${src}" alt=""/>`
const embed = (name: string, data = name) =>
  `<a class="${name}-embed" href="https://example.com/v" target="_blank">` +
  `<img src="https://example.com/preview.jpg" alt="" data-${data}="https://example.com/embed"/></a>`

describe('getMediaKind', () => {
  test.each([
    ['a picture', image('https://b.orbitar.media/2Bjr.png'), 'image'],
    ['a picture without an extension', image('https://api.theins.info/images/c-cNgC'), 'image'],
    ['a picture in a data URI', image('data:image/svg+xml;base64,PHN2Zz4='), 'image'],
    ['two pictures', image('https://orbitar.media/a.jpg') + image('https://orbitar.media/b.webp'), 'image'],
    ['a GIF', image('https://media.tenor.com/rec5dlPBK2cAAAAd/mr-bean-waiting.gif'), 'gif'],
    ['a GIF with a query string', image('https://i.pinimg.com/originals/d3/77.gif?x=1'), 'gif'],
    ['a GIF from Giphy without an extension', image('https://media3.giphy.com/media/v1.Y2lk/giphy'), 'gif'],
    ['a GIF in a data URI', image('data:image/gif;base64,R0lGODlhAQABAAAAACw='), 'gif'],
    ['two GIFs', image('https://media.tenor.com/a.gif') + image('https://media.tenor.com/b.gif'), 'gif'],
    ['pictures and a GIF', image('https://orbitar.media/a.png') + image('https://media.tenor.com/b.gif'), 'image'],
    ['a YouTube embed', embed('youtube'), 'video'],
    ['a Vimeo embed', embed('vimeo'), 'video'],
    ['a Coub embed', embed('coub'), 'video'],
    ['a hosted video with a poster', embed('video'), 'video'],
    ['two hosted videos', embed('video') + embed('video'), 'video'],
    ['a bare video', '<video preload="metadata" controls=""><source src="https://x.com/a.mp4"></video>', 'video'],
    ['an embedded YouTube frame', '<iframe src="https://www.youtube.com/embed/okQUFFwMXgo"></iframe>', 'video'],
    ['a frame of an unknown player', '<iframe src="https://open.spotify.com/embed/track/1"></iframe>', 'media'],
    ['an embed of an unknown kind', embed('tiktok'), 'media'],
    ['a picture next to a video', image('https://orbitar.media/a.png') + embed('youtube'), 'media'],
    ['markup with nothing recognisable', '<p> </p>', 'media'],
    ['nothing at all', '', 'media'],
  ])('names %s', (_label, html, kind) => {
    expect(getMediaKind(html)).toBe(kind)
  })
})
