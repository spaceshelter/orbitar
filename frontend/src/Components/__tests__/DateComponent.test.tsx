import { formatDate } from '../DateComponent'

describe('formatDate', () => {
  test('formats current year dates', () => {
    const date = new Date()
    expect(formatDate(date)).toContain('сегодня')
  })

  test('formats past years with year', () => {
    const date = new Date('2020-01-15T12:00:00Z')
    expect(formatDate(date)).toMatch(/\d{2}\.\d{2}\.\d{4}/)
  })
})
