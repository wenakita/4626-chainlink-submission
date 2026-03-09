export type AgentErrorCode = 'UPSTREAM_ERROR' | 'UPSTREAM_TIMEOUT' | 'BUDGET_EXCEEDED'

export type AgentErrorOptions = {
  retryable?: boolean
  details?: Record<string, unknown>
}

export class AgentError extends Error {
  readonly code: AgentErrorCode
  readonly retryable: boolean
  readonly details?: Record<string, unknown>

  constructor(code: AgentErrorCode, message: string, options: AgentErrorOptions = {}) {
    super(message)
    this.name = 'AgentError'
    this.code = code
    this.retryable = Boolean(options.retryable)
    this.details = options.details
  }
}
