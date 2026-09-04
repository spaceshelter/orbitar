import { Request, Response } from 'express'
import winston from 'winston'

import DB from '../../src/db/DB'
import Session, { evictSessionFromMemory, evictSessionsFromMemory, sessionMemoryStats } from '../../src/session/Session'

const logger = winston.createLogger({ silent: true })

function restore(db: { fetchOne: jest.Mock }, sessionId: string) {
  const request = { header: () => sessionId } as unknown as Request
  const response = { setHeader: jest.fn() } as unknown as Response
  const session = new Session(db as unknown as DB, logger, request, response)
  return session.restore().then(() => session)
}

describe('in-memory session eviction', () => {
  test('a session evicted from memory is re-read from the DB', async () => {
    const db = { fetchOne: jest.fn().mockResolvedValue({ data: JSON.stringify({ userId: 5 }), used: new Date() }) }

    expect((await restore(db, 'sess-a')).data.userId).toBe(5)
    expect(sessionMemoryStats()).toMatchObject({ sessions: 1, users: 1 })

    // the DB row is gone, but the process still serves the cached session
    db.fetchOne.mockResolvedValue(undefined)
    expect((await restore(db, 'sess-a')).data.userId).toBe(5)

    expect(evictSessionsFromMemory(5)).toBe(1)
    expect(evictSessionsFromMemory(5)).toBe(0)
    expect((await restore(db, 'sess-a')).data.userId).toBeFalsy()
    expect(sessionMemoryStats()).toMatchObject({ sessions: 0, users: 0 })
  })

  test('a single session can be evicted by id', async () => {
    const db = { fetchOne: jest.fn().mockResolvedValue({ data: JSON.stringify({ userId: 6 }), used: new Date() }) }
    await restore(db, 'sess-b')
    await restore(db, 'sess-c')
    expect(sessionMemoryStats()).toMatchObject({ sessions: 2, users: 1 })

    expect(evictSessionFromMemory('sess-b')).toBe(true)
    expect(evictSessionFromMemory('sess-b')).toBe(false)
    expect(sessionMemoryStats()).toMatchObject({ sessions: 1, users: 1 })
    expect(evictSessionsFromMemory(6)).toBe(1)
  })
})

  test('sessions created through the login path are indexed and evictable by user id', async () => {
    const db = { fetchOne: jest.fn(), query: jest.fn().mockResolvedValue(undefined) }
    const request = { header: () => undefined } as unknown as Request
    const response = { setHeader: jest.fn() } as unknown as Response
    const session = new Session(db as unknown as DB, logger, request, response)
    const sessionId = await session.init()
    session.data.userId = 7
    await session.store()
    expect(db.query).toHaveBeenCalledTimes(1)

    expect(sessionMemoryStats()).toMatchObject({ sessions: 1, users: 1 })
    db.fetchOne.mockResolvedValue(undefined)
    expect((await restore(db, sessionId)).data.userId).toBe(7)

    expect(evictSessionsFromMemory(7)).toBe(1)
    expect((await restore(db, sessionId)).data.userId).toBeFalsy()
    expect(sessionMemoryStats()).toMatchObject({ sessions: 0, users: 0 })
  })
})
