import { heavyFilterRateLimiter } from '../../src/api/RateLimiters'

const sendMany = async (userId: number, body: Record<string, unknown>, count: number) => {
  const results: string[] = []
  for (let i = 0; i < count; i++) {
    results.push(
      await new Promise<string>((resolve, reject) => {
        const response = { writableEnded: false, status: () => response, send: () => resolve('limited') }
        heavyFilterRateLimiter({ body, session: { data: { userId } } } as any, response as any, (error?: unknown) =>
          error ? reject(error) : resolve('passed'),
        )
      }),
    )
  }
  return results
}

describe('heavyFilterRateLimiter', () => {
  test.each([
    ['minus-only feed pages', 9001, { direction: 'received', sign: 'minus' }],
    ['text-filtered feed pages', 9002, { direction: 'mine', filter: 'needle' }],
  ])('counts %s against the 15/min budget', async (_label, userId, body) => {
    expect(await sendMany(userId, body, 16)).toEqual([...Array(15).fill('passed'), 'limited'])
  })

  test('leaves plain pages, including type and time filters, to the shared read limiter', async () => {
    const results = await sendMany(9003, { direction: 'received', type: 'comment', filter: '  ' }, 20)

    expect(results).toEqual(Array(20).fill('passed'))
  })
})
