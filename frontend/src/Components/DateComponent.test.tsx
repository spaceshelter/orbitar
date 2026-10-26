import { formatDate, formatRelativeAgeBucket } from './DateComponent'

describe('formatDate', () => {
  test('puts the month of a date in the genitive', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    threeDaysAgo.setHours(14, 5)
    expect(formatDate(threeDaysAgo)).toMatch(
      /^\d{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) в 14:05$/,
    )
  })
})

describe('formatRelativeAgeBucket', () => {
  const now = Date.UTC(2026, 6, 1, 12)

  test.each([
    [30 * 1000, '1 минуту назад'],
    [5 * 60 * 1000, '5 минут назад'],
    [2 * 60 * 60 * 1000, 'более 2 часов назад'],
    [3 * 24 * 60 * 60 * 1000, 'более 3 дней назад'],
    [14 * 24 * 60 * 60 * 1000, 'более 2 недель назад'],
  ])('formats a %i ms age', (age, expected) => {
    expect(formatRelativeAgeBucket(new Date(now - age), now)).toBe(expected)
  })

  test('formats calendar months and years', () => {
    expect(formatRelativeAgeBucket(new Date(Date.UTC(2026, 0, 1, 12)), now)).toBe('более 6 месяцев назад')
    expect(formatRelativeAgeBucket(new Date(Date.UTC(2024, 0, 1, 12)), now)).toBe('более 2 лет и 6 месяцев назад')
  })
})
