import * as crypto from 'crypto'

import { Request, RequestHandler, Response } from 'express'
import { Logger } from 'winston'

import { config } from '../config'
import DB from '../db/DB'

const sessionStorage: Record<string, { created: Date; data: SessionData }> = {}
const sessionsByUser: Map<number, Set<string>> = new Map()

function addToUserSessions(userId: number, sessionId: string) {
  // add to user index
  const userSessions = sessionsByUser.get(userId)
  if (userSessions) {
    userSessions.add(sessionId)
  } else {
    const userSessions = new Set([sessionId])
    sessionsByUser.set(userId, userSessions)
  }
}

function deleteFromUserSessions(userId: number, sessionId: string) {
  // remove from user index
  const userSessions = sessionsByUser.get(userId)
  if (userSessions) {
    userSessions.delete(sessionId)
  }
}

/**
 * Drops the in-memory copies of a user's sessions. Rows in the `sessions` table are left alone:
 * pair this with a DB delete to force a logout. The process keeps honouring cached sessions
 * until they are evicted here, so a DB-only cleanup is not enough.
 */
export function evictSessionsFromMemory(userId: number): number {
  const userSessions = sessionsByUser.get(userId)
  if (!userSessions) {
    return 0
  }
  let evicted = 0
  for (const sessionId of userSessions) {
    if (sessionStorage[sessionId]) {
      delete sessionStorage[sessionId]
      evicted++
    }
  }
  sessionsByUser.delete(userId)
  return evicted
}

export function evictSessionFromMemory(sessionId: string): boolean {
  const cached = sessionStorage[sessionId]
  if (!cached) {
    return false
  }
  delete sessionStorage[sessionId]
  if (cached.data.userId) {
    deleteFromUserSessions(cached.data.userId, sessionId)
  }
  return true
}

export function sessionMemoryStats(): { sessions: number; users: number } {
  return { sessions: Object.keys(sessionStorage).length, users: sessionsByUser.size }
}

export default class Session {
  private request: Request
  private response: Response
  private db: DB
  private logger: Logger
  private static SESSION_HEADER = 'X-Session-Id'
  public id?: string
  public data?: SessionData
  public created: Date

  constructor(db: DB, logger: Logger, request: Request, response: Response) {
    this.request = request
    this.response = response
    this.db = db
    this.logger = logger
    this.id = request.header(Session.SESSION_HEADER)
  }

  async restore(sessionIdFromRequest?: string) {
    const sessId = this.id || sessionIdFromRequest
    if (!sessId || sessId === '-') {
      this.data = new SessionData('')
      return
    }

    const cached = sessionStorage[sessId]
    if (cached) {
      this.data = cached.data
      this.created = cached.created
      this.response.setHeader(Session.SESSION_HEADER, sessId)
      return
    }

    const storedData = await this.db.fetchOne<{
      data: string
      used: Date
    }>('select used, data from sessions where id=:id', {
      id: sessId,
    })
    if (storedData) {
      this.logger.verbose(`Session ${sessId} restored from DB`, { session: sessId, data: storedData.data })
      try {
        const parsedData = JSON.parse(storedData.data)
        if (parsedData.userId) {
          this.data = new SessionData(sessId, parsedData.userId)
          this.created = storedData.used
          sessionStorage[sessId] = {
            created: this.created,
            data: this.data,
          }
          addToUserSessions(this.data.userId, sessId)
          this.response.setHeader(Session.SESSION_HEADER, sessId)
          return
        }
      } catch {
        // could not parse session, continue to reset
      }
    }

    this.logger.verbose(`Session ${this.id} not found in DB`, { session: this.id })

    this.response.setHeader(Session.SESSION_HEADER, '-')
    this.data = new SessionData('')
  }

  public getAgeMillis() {
    if (!this.created) return 0
    const now = new Date()
    return now.getTime() - this.created.getTime()
  }

  public isBarmalini() {
    return config.barmalini.userId && this.data?.userId === config.barmalini.userId
  }

  private async generate(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(32, (err, buffer) => {
        if (err) {
          reject(err)
          return
        }
        resolve(buffer.toString('hex'))
      })
    })
  }

  async init() {
    if (this.id) {
      await this.destroy()
    }

    this.id = await this.generate()
    this.data = new SessionData(this.id)
    this.created = new Date()
    sessionStorage[this.id] = { created: this.created, data: this.data }

    this.response.setHeader(Session.SESSION_HEADER, this.id)

    return this.id
  }

  async destroy() {
    if (!this.id) return
    const userId = this.data.userId
    this.data.clear()
    this.data = new SessionData('')
    delete sessionStorage[this.id]
    if (userId) {
      deleteFromUserSessions(userId, this.id)
    }
    this.logger.verbose(`Session ${this.id} removed from DB`, { session: this.id })

    await this.db.query('delete from sessions where id=:id', {
      id: this.id,
    })

    this.id = undefined
    this.response.setHeader(Session.SESSION_HEADER, '-')
  }

  async destroyAllForCurrentUser() {
    if (!this.id || !this.data?.userId) return
    const userSessions = sessionsByUser.get(this.data.userId)
    if (userSessions) {
      sessionsByUser.delete(this.data.userId)
      for (const sessionId of userSessions) {
        delete sessionStorage[sessionId]
      }
    }
    await this.db.query('delete from sessions where user_id=:userId', {
      userId: this.data.userId,
    })
    this.data.clear()
    this.data = new SessionData('')
    this.id = undefined

    this.response.setHeader(Session.SESSION_HEADER, '-')
  }

  async store() {
    if (!this.id) return

    if (this.data.userId) {
      // The login path is init() -> data.userId = ... -> store(); restore() only indexes sessions it
      // re-reads from the DB. Index here too, so per-user eviction and destroyAllForCurrentUser()
      // see sessions created since the last restart.
      addToUserSessions(this.data.userId, this.id)
    }

    const data = {
      userId: this.data.userId,
    }
    const stringData = JSON.stringify(data)

    await this.db.query(
      `insert into sessions (id, user_id, data)
             values (:id, :user_id, :data)
                 on duplicate key update
                        user_id=:user_id,
                        data=:data`,
      {
        id: this.id,
        user_id: this.data.userId,
        data: stringData,
      },
    )

    this.logger.verbose(`Session ${this.id} stored to DB`, { session: this.id, data: data })
  }
}

export class SessionData {
  private sessionId: string
  public userId = 0

  constructor(id, userId?: number) {
    this.sessionId = id
    this.userId = userId
  }

  clear() {
    this.userId = undefined
  }
}

export function session(db: DB, logger: Logger): RequestHandler {
  return (req, res, next) => {
    req.session = new Session(db, logger, req, res)
    // create async block to encapsulate async logic
    const asyncBlock = async () => {
      try {
        await req.session.restore(req.body['X-Session-Id'])
        if (req.session.isBarmalini() && req.session.getAgeMillis() > /*1 hour*/ 60 * 60 * 1000) {
          await req.session.destroy()
        }
        next()
      } catch (error) {
        logger.error('Could not restore session', { error: error })
        res.error('error', 'Unknown error', 500)
      }
    }
    // call the async block (returns a promise)
    return asyncBlock()
  }
}
