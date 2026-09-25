import { heavyReadRateLimiter } from '../../src/api/RateLimiters'

// Sends one request through the real limiter and reports whether it reached the handler.
const send = (userId: number, body: Record<string, unknown>) =>
  new Promise<'passed' | 'limited'>((resolve, reject) => {
    const response = {
      writableEnded: false,
      status: () => response,
      send: () => resolve('limited'),
    }
    heavyReadRateLimiter({ body, session: { data: { userId } } } as any, response as any, (error?: unknown) =>
      error ? reject(error) : resolve('passed'),
    )
  })

const sendMany = async (userId: number, body: Record<string, unknown>, count: number) => {
  const results: string[] = []
  for (let i = 0; i < count; i++) {
    results.push(await send(userId, body))
  }
  return results
}

describe('heavyReadRateLimiter', () => {
  test('counts minus-only feed pages against the 15/min budget', async () => {
    const results = await sendMany(9001, { direction: 'received', sign: 'minus' }, 16)

    expect(results.slice(0, 15)).toEqual(Array(15).fill('passed'))
    expect(results[15]).toBe('limited')
  })

  test('counts text-filtered feed pages against the same budget', async () => {
    const results = await sendMany(9002, { direction: 'mine', filter: 'needle' }, 16)

    expect(results[14]).toBe('passed')
    expect(results[15]).toBe('limited')
  })

  test('leaves plain pages, including type and time filters, to the shared read limiter', async () => {
    const results = await sendMany(9003, { direction: 'received', type: 'comment', filter: '  ' }, 20)

    expect(results).toEqual(Array(20).fill('passed'))
  })
})
