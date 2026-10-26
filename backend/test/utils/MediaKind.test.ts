import TheParser from '../../src/parser/TheParser'
import { getMediaKind } from '../../src/utils/MediaKind'

const parser = new TheParser({
  mediaHosting: { url: 'https://orbitar.media', dimsAesKey: '' },
  siteDomain: 'orbitar.local',
})
const html = (source: string) => parser.parse(source).text

describe('getMediaKind', () => {
  test.each([
    ['a picture', html('https://b.orbitar.media/2Bjr.png'), 'image'],
    ['two pictures', html('https://orbitar.media/a.jpg https://orbitar.media/b.webp'), 'image'],
    ['a GIF', html('https://media.tenor.com/rec5dlPBK2cAAAAd/mr-bean-waiting.gif'), 'gif'],
    ['two GIFs', html('https://media.tenor.com/a.gif https://media.tenor.com/b.gif'), 'gif'],
    ['pictures and a GIF', html('https://orbitar.media/a.png https://media.tenor.com/b.gif'), 'image'],
    ['a YouTube video', html('https://www.youtube.com/watch?v=aboZctrHfK8'), 'video'],
    ['a Coub', html('https://coub.com/view/1eyshv'), 'video'],
    ['a video tag', html('<video src="https://example.com/a.mp4">'), 'video'],
    ['a picture and a video', html('https://orbitar.media/a.png https://youtu.be/aboZctrHfK8'), 'media'],
    ['a picture saved before media was tagged', '<img src="https://orbitar.media/a.png" alt=""/>', 'media'],
    ['a frame the parser never renders', '<iframe src="https://open.spotify.com/embed/track/1"></iframe>', 'media'],
    ['a kind it does not know', '<img src="https://orbitar.media/a.png" alt="" data-media="audio"/>', 'media'],
    ['nothing', '', 'media'],
  ])('%s', (_label, source, kind) => {
    expect(getMediaKind(source)).toBe(kind)
  })
})
