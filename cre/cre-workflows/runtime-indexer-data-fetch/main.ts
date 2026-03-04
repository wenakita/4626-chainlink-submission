import {
  consensusIdenticalAggregation,
  CronCapability,
  HTTPClient,
  handler,
  Runner,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk"
import {
  bytesToBase64,
  decodeJsonBody,
  sha256Hex,
  stableJsonStringify,
} from "../_shared/determinism"
import { postJson } from "../_shared/http"

type Config = {
  schedule: string
  apiBaseUrl: string
  workflowName: string
  sinkEnabled?: boolean
  graphqlEndpoint: string
  query: string
  variables?: Record<string, unknown>
  mockGraphData?: Record<string, unknown>
}

type GraphQLResponse = {
  data?: Record<string, unknown>
  errors?: unknown[]
}

type GraphSnapshot = {
  endpoint: string
  data: Record<string, unknown>
  digest: string
  source: "mock" | "remote"
}

type IngestResponse = {
  success: boolean
  error?: string
}

function fetchGraphSnapshot(nodeRuntime: NodeRuntime<Config>, httpClient: HTTPClient): GraphSnapshot {
  if (nodeRuntime.config.mockGraphData) {
    const digest = sha256Hex(stableJsonStringify(nodeRuntime.config.mockGraphData))
    return {
      endpoint: "mock://graphql",
      data: nodeRuntime.config.mockGraphData,
      digest,
      source: "mock",
    }
  }

  const requestPayload = stableJsonStringify({
    query: nodeRuntime.config.query,
    variables: nodeRuntime.config.variables ?? {},
  })

  const response = httpClient.sendRequest(nodeRuntime, {
    url: nodeRuntime.config.graphqlEndpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: bytesToBase64(new TextEncoder().encode(requestPayload)),
  }).result()

  if (response.statusCode >= 400) {
    throw new Error(`graphql_request_failed_${response.statusCode}`)
  }

  const parsed = decodeJsonBody<GraphQLResponse>(response.body)
  if (parsed.errors && parsed.errors.length > 0) {
    throw new Error(`graphql_errors:${stableJsonStringify(parsed.errors)}`)
  }
  if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    throw new Error("graphql_response_missing_data")
  }

  const digest = sha256Hex(stableJsonStringify(parsed.data))
  return {
    endpoint: nodeRuntime.config.graphqlEndpoint,
    data: parsed.data,
    digest,
    source: "remote",
  }
}

const onCronTrigger = (runtime: Runtime<Config>): string => {
  const httpClient = new HTTPClient()
  const snapshotJson = runtime.runInNodeMode(
    (nodeRuntime: NodeRuntime<Config>) =>
      stableJsonStringify(fetchGraphSnapshot(nodeRuntime, httpClient)),
    consensusIdenticalAggregation(),
  )().result()
  const snapshot = JSON.parse(snapshotJson) as GraphSnapshot

  const emittedAt = runtime.now().toISOString()
  const summary = {
    emittedAt,
    endpoint: snapshot.endpoint,
    source: snapshot.source,
    digest: snapshot.digest,
    data: snapshot.data,
  }

  runtime.log(
    `Indexer fetch complete source=${snapshot.source} digest=${snapshot.digest.slice(0, 12)}`,
  )

  if (runtime.config.sinkEnabled === false) {
    return JSON.stringify({ ...summary, sink: "disabled" }, null, 2)
  }

  const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
  const sinkAccepted = runtime.runInNodeMode(
    (nodeRuntime: NodeRuntime<Config>) => {
      const response = postJson<Config, IngestResponse>(
        nodeRuntime,
        httpClient,
        apiKey,
        "/cre/runtime/ingest",
        {
          workflow: runtime.config.workflowName,
          kind: "metrics",
          idempotencyKey: snapshot.digest,
          payload: summary,
          source: "cre-runtime-indexer-data-fetch",
        },
      )
      return response.success
    },
    consensusIdenticalAggregation(),
  )().result()

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

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
