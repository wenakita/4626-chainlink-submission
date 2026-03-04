import {
  consensusIdenticalAggregation,
  consensusMedianAggregation,
  CronCapability,
  decodeJson,
  HTTPCapability,
  HTTPClient,
  handler,
  Runner,
  type HTTPPayload,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk"
import { getJson, postJson } from "../_shared/http"
import { readKvNumber, type AwsCredentials, writeKvText } from "../_shared/kvState"

type Config = {
  schedule: string
  apiBaseUrl: string
  workflowName: string
  blockSourceWorkflow?: string
  checkpointIntervalSeconds: number
  minMatchedTransactionsForAction: number
  sinkEnabled?: boolean
  kvDisabled?: boolean
  initialCheckpoint?: number
  mockLatestBlockNumber?: number
  mockMatchedTransactions?: number
  aws_region: string
  s3_bucket: string
  s3_key: string
}

type ManualPayload = {
  checkpointKey?: string
  latestBlockNumber?: number
  matchedTransactions?: number
  reason?: string
  enqueueAction?: {
    vaultAddress?: string
    groupId?: string
    actionType?: string
    action?: Record<string, unknown>
    dedupeKey?: string
  }
}

type IngestListResponse = {
  success: boolean
  data?: {
    records?: Array<{
      workflow?: string
      payload?: {
        blockNumber?: number
        matchedTransactions?: number
      }
    }>
    count?: number
  }
  error?: string
}

type DecisionResponse = {
  success: boolean
  error?: string
}

type OrchestratorResult = {
  workflow: string
  trigger: "cron" | "http"
  reason: string
  previousCheckpoint: number
  latestBlockNumber: number
  nextCheckpoint: number
  matchedTransactions: number
  shouldAct: boolean
  idempotencyKey: string
  sink: "disabled" | "accepted"
}

function parseManualPayload(payload: HTTPPayload): ManualPayload {
  if (!payload.input || payload.input.length === 0) return {}
  return decodeJson(payload.input) as ManualPayload
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizedLatestBlockFromManual(manual: ManualPayload | undefined): number | null {
  const parsed = toFiniteNumber(manual?.latestBlockNumber)
  if (parsed === null) return null
  return Math.max(0, Math.floor(parsed))
}

function normalizedMatchedFromManual(manual: ManualPayload | undefined): number | null {
  const parsed = toFiniteNumber(manual?.matchedTransactions)
  if (parsed === null) return null
  return Math.max(0, Math.floor(parsed))
}

function slotKey(now: Date, intervalSeconds: number): string {
  const interval = Math.max(1, intervalSeconds)
  const slot = Math.floor(now.getTime() / 1000 / interval)
  return `slot:${slot}`
}

function fetchBlockWindowSnapshot(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  minBlockExclusive: number,
): { blockNumber: number; matchedTransactions: number } | null {
  if (typeof nodeRuntime.config.mockLatestBlockNumber === "number") {
    return {
      blockNumber: Math.max(0, Math.floor(nodeRuntime.config.mockLatestBlockNumber)),
      matchedTransactions: Math.max(0, Math.floor(nodeRuntime.config.mockMatchedTransactions ?? 0)),
    }
  }

  const sourceWorkflow = nodeRuntime.config.blockSourceWorkflow ?? "runtime-indexer-block"
  const response = getJson<Config, IngestListResponse>(
    nodeRuntime,
    httpClient,
    apiKey,
    `/cre/runtime/ingest?kind=block&workflow=${encodeURIComponent(sourceWorkflow)}&limit=100`,
  )
  if (!response.success) return null

  let latestBlockNumber = minBlockExclusive
  let matchedTransactions = 0
  for (const record of response.data?.records ?? []) {
    const blockNumber = toFiniteNumber(record?.payload?.blockNumber)
    if (blockNumber === null) continue
    const normalizedBlockNumber = Math.max(0, Math.floor(blockNumber))
    if (normalizedBlockNumber <= minBlockExclusive) continue
    latestBlockNumber = Math.max(latestBlockNumber, normalizedBlockNumber)
    matchedTransactions += Math.max(
      0,
      Math.floor(toFiniteNumber(record?.payload?.matchedTransactions) ?? 0),
    )
  }
  if (latestBlockNumber <= minBlockExclusive) return null

  return { blockNumber: latestBlockNumber, matchedTransactions }
}

function runOrchestration(
  runtime: Runtime<Config>,
  trigger: "cron" | "http",
  manual?: ManualPayload,
): OrchestratorResult {
  const now = runtime.now()
  const checkpointSuffix = manual?.checkpointKey?.trim() || slotKey(now, runtime.config.checkpointIntervalSeconds)
  const idempotencyKey = `${runtime.config.workflowName}:${checkpointSuffix}`
  const httpClient = new HTTPClient()
  const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
  const awsCreds: AwsCredentials | null = runtime.config.kvDisabled
    ? null
    : {
        accessKeyId: runtime.getSecret({ id: "AWS_ACCESS_KEY_ID" }).result().value,
        secretAccessKey: runtime.getSecret({ id: "AWS_SECRET_ACCESS_KEY" }).result().value,
      }

  const previousCheckpoint = runtime.config.kvDisabled
    ? Math.max(0, Math.floor(runtime.config.initialCheckpoint ?? 0))
    : runtime.runInNodeMode(
        (nodeRuntime: NodeRuntime<Config>) => {
          return readKvNumber(nodeRuntime, httpClient, awsCreds!, now)
        },
        consensusMedianAggregation<number>(),
      )().result()

  const latestFromSource = runtime.runInNodeMode(
    (nodeRuntime: NodeRuntime<Config>) =>
      fetchBlockWindowSnapshot(nodeRuntime, httpClient, apiKey, previousCheckpoint),
    consensusIdenticalAggregation(),
  )().result()

  const manualLatestBlock = normalizedLatestBlockFromManual(manual)
  const manualMatched = normalizedMatchedFromManual(manual)
  const latestBlockNumber = manualLatestBlock ?? latestFromSource?.blockNumber ?? previousCheckpoint
  const matchedTransactions = manualMatched ?? latestFromSource?.matchedTransactions ?? 0

  const nextCheckpoint = Math.max(previousCheckpoint, latestBlockNumber)
  const shouldAct =
    nextCheckpoint > previousCheckpoint &&
    matchedTransactions >= Math.max(0, runtime.config.minMatchedTransactionsForAction)

  const reason = manual?.reason?.trim() || (shouldAct ? "checkpoint_advanced" : "no_advance")
  if (runtime.config.sinkEnabled === false) {
    if (!runtime.config.kvDisabled) {
      runtime.runInNodeMode(
        (nodeRuntime: NodeRuntime<Config>) =>
          writeKvText(nodeRuntime, httpClient, awsCreds!, String(nextCheckpoint), now),
        consensusIdenticalAggregation(),
      )().result()
    }
    return {
      workflow: runtime.config.workflowName,
      trigger,
      reason,
      previousCheckpoint,
      latestBlockNumber,
      nextCheckpoint,
      matchedTransactions,
      shouldAct,
      idempotencyKey,
      sink: "disabled",
    }
  }

  const maybeEnqueue =
    shouldAct &&
    manual?.enqueueAction &&
    typeof manual.enqueueAction.action === "object" &&
    !Array.isArray(manual.enqueueAction.action) &&
    typeof manual.enqueueAction.vaultAddress === "string" &&
    typeof manual.enqueueAction.groupId === "string" &&
    typeof manual.enqueueAction.actionType === "string"
      ? {
          vaultAddress: manual.enqueueAction.vaultAddress,
          groupId: manual.enqueueAction.groupId,
          actionType: manual.enqueueAction.actionType,
          action: manual.enqueueAction.action,
          dedupeKey: manual.enqueueAction.dedupeKey,
        }
      : undefined

  const sinkAccepted = runtime.runInNodeMode(
    (nodeRuntime: NodeRuntime<Config>) => {
      const response = postJson<Config, DecisionResponse>(
        nodeRuntime,
        httpClient,
        apiKey,
        "/cre/runtime/decisions",
        {
          workflow: runtime.config.workflowName,
          idempotencyKey,
          decision: {
            trigger,
            reason,
            previousCheckpoint,
            latestBlockNumber,
            nextCheckpoint,
            matchedTransactions,
            shouldAct,
            emittedAt: now.toISOString(),
          },
          ...(maybeEnqueue ? { enqueueAction: maybeEnqueue } : {}),
        },
      )
      return response.success
    },
    consensusIdenticalAggregation(),
  )().result()

  if (!sinkAccepted) {
    throw new Error("runtime_decision_sink_failed")
  }

  if (!runtime.config.kvDisabled) {
    runtime.runInNodeMode(
      (nodeRuntime: NodeRuntime<Config>) =>
        writeKvText(nodeRuntime, httpClient, awsCreds!, String(nextCheckpoint), now),
      consensusIdenticalAggregation(),
    )().result()
  }

  return {
    workflow: runtime.config.workflowName,
    trigger,
    reason,
    previousCheckpoint,
    latestBlockNumber,
    nextCheckpoint,
    matchedTransactions,
    shouldAct,
    idempotencyKey,
    sink: "accepted",
  }
}

const onCronTrigger = (runtime: Runtime<Config>): string => {
  const result = runOrchestration(runtime, "cron")
  return JSON.stringify(result, null, 2)
}

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const manual = parseManualPayload(payload)
  const result = runOrchestration(runtime, "http", manual)
  return JSON.stringify(result, null, 2)
}

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  const http = new HTTPCapability()
  return [
    handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
    handler(http.trigger({}), onHttpTrigger),
  ]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
