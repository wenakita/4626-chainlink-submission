export function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(String(raw ?? '').trim())
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

type BudgetCheckInput = {
  inputTokens?: number
  outputTokens?: number
  estimatedUsd?: number
}

type BudgetCounter = {
  dayKey: string
  usedTokens: number
  usedUsd: number
}

type BudgetCheckResult = {
  allowed: boolean
  reason?: 'token' | 'usd'
}

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export class DailyBudgetGuard {
  private readonly tokenBudget: number | null
  private readonly usdBudget: number | null
  private readonly usage = new Map<string, BudgetCounter>()

  constructor(tokenBudget: number | null, usdBudget: number | null) {
    this.tokenBudget = tokenBudget
    this.usdBudget = usdBudget
  }

  private getCounter(agentKey: string): BudgetCounter {
    const dayKey = utcDayKey()
    const current = this.usage.get(agentKey)
    if (current && current.dayKey === dayKey) return current

    const next = { dayKey, usedTokens: 0, usedUsd: 0 }
    this.usage.set(agentKey, next)
    return next
  }

  canConsume(agentKey: string, input: BudgetCheckInput): BudgetCheckResult {
    const counter = this.getCounter(agentKey)
    const tokenDelta = Math.max(0, Math.floor((input.inputTokens ?? 0) + (input.outputTokens ?? 0)))
    const usdDelta = Math.max(0, input.estimatedUsd ?? 0)

    if (this.tokenBudget !== null && counter.usedTokens + tokenDelta > this.tokenBudget) {
      return { allowed: false, reason: 'token' }
    }
    if (this.usdBudget !== null && counter.usedUsd + usdDelta > this.usdBudget) {
      return { allowed: false, reason: 'usd' }
    }
    return { allowed: true }
  }

  record(agentKey: string, input: BudgetCheckInput): void {
    const counter = this.getCounter(agentKey)
    counter.usedTokens += Math.max(0, Math.floor((input.inputTokens ?? 0) + (input.outputTokens ?? 0)))
    counter.usedUsd += Math.max(0, input.estimatedUsd ?? 0)
  }
}
