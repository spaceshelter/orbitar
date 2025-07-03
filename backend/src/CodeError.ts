export default class CodeError extends Error {
  public code: string
  public statusCode?: number
  public meta?: Record<string, unknown>

  constructor(code: string, message: string, statusCode?: number, meta?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.meta = meta
  }
}
