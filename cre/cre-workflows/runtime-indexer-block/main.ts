import {
  consensusIdenticalAggregation,
  decodeJson,
  HTTPCapability,
  HTTPClient,
  handler,
  Runner,
  type HTTPPayload,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk"
import { postJson } from "../_shared/http"
import { sha256Hex, stableSortBy, stableSortStrings } from "../_shared/determinism"

type Config = {
  apiBaseUrl: string
  workflowName: string
  sinkEnabled?: boolean
  watchedAddresses: string[]
}

type WebhookPayload = {
  event?: {
    data?: {
      block?: {
        hash: string
        number: number
        timestamp: number
        logs: Array<{
          transaction?: {
            hash: string
            nonce?: number
            index?: number
            from?: { address?: string }
            to?: { address?: string | null } | null
            value?: string
            gasPrice?: string
            gas?: number
            status?: number
            gasUsed?: number
          }
        }>
      }
    }
  }
}

type MatchedTransaction = {
  hash: string
  nonce: number
  index: number
  from: string
  to: string
  value: string
  gasPrice: string
  gas: number
  status: number
  gasUsed: number
  blockNumber: number
  blockHash: string
  timestamp: number
}

type BlockSummary = {
  blockNumber: number
  blockHash: string
  timestamp: number
  totalLogs: number
  uniqueTransactions: number
  matchedTransactions: number
  transactions: MatchedTransaction[]
  idempotencyKey: string
}

type IngestResponse = {
  success: boolean
  error?: string
}

function parseWebhookPayload(payload: HTTPPayload): WebhookPayload {
  return decodeJson(payload.input) as WebhookPayload
}

function buildSummary(config: Config, payload: WebhookPayload): BlockSummary {
  const block = payload.event?.data?.block
  if (!block) {
    throw new Error("invalid_block_payload")
  }

  const watched = new Set(config.watchedAddresses.map((value) => value.toLowerCase()))
  const processedHashes = new Set<string>()
  const matched: MatchedTransaction[] = []

  for (const log of block.logs) {
    const tx = log.transaction
    if (!tx?.hash) continue
    if (processedHashes.has(tx.hash)) continue
    processedHashes.add(tx.hash)

    const toAddress = tx.to?.address?.toLowerCase() ?? null
    if (!toAddress || !watched.has(toAddress)) continue

    matched.push({
      hash: tx.hash,
      nonce: tx.nonce ?? 0,
      index: tx.index ?? 0,
      from: tx.from?.address ?? "",
      to: tx.to?.address ?? "",
      value: tx.value ?? "0x0",
      gasPrice: tx.gasPrice ?? "0x0",
      gas: tx.gas ?? 0,
      status: tx.status ?? 0,
      gasUsed: tx.gasUsed ?? 0,
      blockNumber: block.number,
      blockHash: block.hash,
      timestamp: block.timestamp,
    })
  }

  const orderedTransactions = stableSortBy(matched, (entry) => entry.hash.toLowerCase())
  const txHashes = stableSortStrings(orderedTransactions.map((entry) => entry.hash.toLowerCase()))
  const idempotencyKey = sha256Hex(`${block.hash.toLowerCase()}:${txHashes.join(",")}`)

  return {
    blockNumber: block.number,
    blockHash: block.hash,
    timestamp: block.timestamp,
    totalLogs: block.logs.length,
    uniqueTransactions: processedHashes.size,
    matchedTransactions: orderedTransactions.length,
    transactions: orderedTransactions,
    idempotencyKey,
  }
}

function sinkSummary(
  runtime: Runtime<Config>,
  summary: BlockSummary,
): boolean {
  const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
  const httpClient = new HTTPClient()
  return runtime.runInNodeMode(
    (nodeRuntime: NodeRuntime<Config>) => {
      const response = postJson<Config, IngestResponse>(
        nodeRuntime,
        httpClient,
        apiKey,
        "/cre/runtime/ingest",
        {
          workflow: runtime.config.workflowName,
          kind: "block",
          idempotencyKey: summary.idempotencyKey,
          payload: summary,
          source: "cre-runtime-indexer-block",
        },
      )
      return response.success
    },
    consensusIdenticalAggregation(),
  )().result()
}

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const parsedPayload = parseWebhookPayload(payload)
  const summary = buildSummary(runtime.config, parsedPayload)

  runtime.log(
    `Processed block payload block=${summary.blockNumber} uniqueTransactions=${summary.uniqueTransactions} matchedTransactions=${summary.matchedTransactions}`,
  )

  if (runtime.config.sinkEnabled === false) {
    return JSON.stringify({ ...summary, sink: "disabled" }, null, 2)
  }

  const sinkAccepted = sinkSummary(runtime, summary)
  if (!sinkAccepted) {
    throw new Error("runtime_ingest_failed")
  }

  return JSON.stringify(
    {
      ...summary,
      sink: "accepted",
    },
    null,
    2,
  )
}

const initWorkflow = (_config: Config) => {
  const http = new HTTPCapability()
  return [handler(http.trigger({}), onHttpTrigger)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
