import { formatDate } from './DateComponent'

describe('formatDate', () => {
  test('puts the month of a date in the genitive', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    threeDaysAgo.setHours(14, 5)
    expect(formatDate(threeDaysAgo)).toMatch(
      /^\d{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) в 14:05$/,
    )
  })
})
