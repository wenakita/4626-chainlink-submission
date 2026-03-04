import {
  bytesToHex,
  consensusIdenticalAggregation,
  CronCapability,
  EVMClient,
  encodeCallMsg,
  getNetwork,
  handler,
  HTTPClient,
  LAST_FINALIZED_BLOCK_NUMBER,
  Runner,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk"
import {
  decodeAbiParameters,
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  type Address,
  zeroAddress,
} from "viem"
import { postJson } from "../_shared/http"
import { sha256Hex, stableJsonStringify, stableSortBy } from "../_shared/determinism"

type FeedConfig = {
  name: string
  address: string
}

type DecodedBundle = {
  lastModifiedDateTimeRaw: string
  lastModifiedDateTimeRfc3339: string
  securityId: string
  securityName: string
  ssaRaw: string
  ssaScaled: string
  ssaDesc: string
  ssaDecimal: number
}

type PriceFeedResult = {
  name: string
  address: string
  decimals: number
  latestAnswerRaw: string
  scaled: string
}

type MvrFeedResult = {
  name: string
  address: string
  bundle: DecodedBundle
  bundleDecimals: number[]
}

type Config = {
  schedule: string
  apiBaseUrl: string
  workflowName: string
  sinkEnabled?: boolean
  chainName: string
  feeds: FeedConfig[]
  mvrFeeds?: FeedConfig[]
  mockResults?: {
    feeds?: PriceFeedResult[]
    mvrFeeds?: MvrFeedResult[]
  }
}

type IngestResponse = {
  success: boolean
  error?: string
}

const PRICE_FEED_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "latestAnswer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "int256" }],
  },
] as const

const BUNDLE_AGGREGATOR_PROXY_ABI = [
  {
    type: "function",
    name: "bundleDecimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8[]" }],
  },
  {
    type: "function",
    name: "latestBundle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes" }],
  },
] as const

function getEvmClient(chainName: string): EVMClient {
  const primary = getNetwork({
    chainFamily: "evm",
    chainSelectorName: chainName,
    isTestnet: false,
  })
  const fallback = getNetwork({
    chainFamily: "evm",
    chainSelectorName: chainName,
    isTestnet: true,
  })

  const network = primary ?? fallback
  if (!network) {
    throw new Error(`network_not_found:${chainName}`)
  }

  return new EVMClient(network.chainSelector.selector)
}

function readPriceFeed(
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  feed: FeedConfig,
): PriceFeedResult {
  const decimalsData = encodeFunctionData({
    abi: PRICE_FEED_ABI,
    functionName: "decimals",
  })
  const decimalsResp = evmClient.callContract(runtime, {
    call: encodeCallMsg({
      from: zeroAddress,
      to: feed.address as Address,
      data: decimalsData,
    }),
    blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
  }).result()
  const decimals = decodeFunctionResult({
    abi: PRICE_FEED_ABI,
    functionName: "decimals",
    data: bytesToHex(decimalsResp.data),
  }) as number

  const answerData = encodeFunctionData({
    abi: PRICE_FEED_ABI,
    functionName: "latestAnswer",
  })
  const answerResp = evmClient.callContract(runtime, {
    call: encodeCallMsg({
      from: zeroAddress,
      to: feed.address as Address,
      data: answerData,
    }),
    blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
  }).result()
  const latestAnswer = decodeFunctionResult({
    abi: PRICE_FEED_ABI,
    functionName: "latestAnswer",
    data: bytesToHex(answerResp.data),
  }) as bigint

  return {
    name: feed.name,
    address: feed.address,
    decimals,
    latestAnswerRaw: latestAnswer.toString(),
    scaled: formatUnits(latestAnswer, decimals),
  }
}

function readMvrFeed(
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  feed: FeedConfig,
): MvrFeedResult {
  const decimalsCall = encodeFunctionData({
    abi: BUNDLE_AGGREGATOR_PROXY_ABI,
    functionName: "bundleDecimals",
  })
  const decimalsResp = evmClient.callContract(runtime, {
    call: encodeCallMsg({
      from: zeroAddress,
      to: feed.address as Address,
      data: decimalsCall,
    }),
    blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
  }).result()
  const decodedDecimals = decodeFunctionResult({
    abi: BUNDLE_AGGREGATOR_PROXY_ABI,
    functionName: "bundleDecimals",
    data: bytesToHex(decimalsResp.data),
  }) as readonly (number | bigint)[]
  const bundleDecimals = decodedDecimals.map((value) => Number(value))

  const bundleCall = encodeFunctionData({
    abi: BUNDLE_AGGREGATOR_PROXY_ABI,
    functionName: "latestBundle",
  })
  const bundleResp = evmClient.callContract(runtime, {
    call: encodeCallMsg({
      from: zeroAddress,
      to: feed.address as Address,
      data: bundleCall,
    }),
    blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
  }).result()
  const latestBundleBytes = decodeFunctionResult({
    abi: BUNDLE_AGGREGATOR_PROXY_ABI,
    functionName: "latestBundle",
    data: bytesToHex(bundleResp.data),
  }) as `0x${string}`

  const [lastModified, securityId, securityName, ssa, ssaDesc] = decodeAbiParameters(
    [
      { type: "uint256", name: "lastModifiedDateTime" },
      { type: "string", name: "securityId" },
      { type: "string", name: "securityName" },
      { type: "uint256", name: "ssa" },
      { type: "string", name: "ssaDesc" },
    ],
    latestBundleBytes,
  ) as [bigint, string, string, bigint, string]

  const timestampRaw = lastModified.toString()
  const seconds = Number(lastModified)
  const timestampIso = Number.isSafeInteger(seconds)
    ? new Date(seconds * 1000).toISOString()
    : ""
  const ssaDecimal = bundleDecimals[3] ?? 0

  return {
    name: feed.name,
    address: feed.address,
    bundle: {
      lastModifiedDateTimeRaw: timestampRaw,
      lastModifiedDateTimeRfc3339: timestampIso,
      securityId,
      securityName,
      ssaRaw: ssa.toString(),
      ssaScaled: formatUnits(ssa, ssaDecimal),
      ssaDesc,
      ssaDecimal,
    },
    bundleDecimals,
  }
}

const onCronTrigger = (runtime: Runtime<Config>): string => {
  const orderedFeeds = stableSortBy(runtime.config.feeds ?? [], (entry) => entry.address.toLowerCase())
  const orderedMvrFeeds = stableSortBy(runtime.config.mvrFeeds ?? [], (entry) =>
    entry.address.toLowerCase(),
  )
  const evmClient = runtime.config.mockResults ? null : getEvmClient(runtime.config.chainName)

  const feeds =
    runtime.config.mockResults?.feeds ??
    orderedFeeds.map((feed) => readPriceFeed(runtime, evmClient!, feed))
  const mvrFeeds =
    runtime.config.mockResults?.mvrFeeds ??
    orderedMvrFeeds.map((feed) => readMvrFeed(runtime, evmClient!, feed))

  const emittedAt = runtime.now().toISOString()
  const valueSnapshot = {
    chainName: runtime.config.chainName,
    feeds,
    mvrFeeds,
  }
  const digest = sha256Hex(stableJsonStringify(valueSnapshot))
  const payload = {
    emittedAt,
    ...valueSnapshot,
  }

  runtime.log(
    `Reference feeds snapshot feeds=${feeds.length} mvrFeeds=${mvrFeeds.length} digest=${digest.slice(0, 12)}`,
  )

  if (runtime.config.sinkEnabled === false) {
    return JSON.stringify({ ...payload, digest, sink: "disabled" }, null, 2)
  }

  const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
  const httpClient = new HTTPClient()
  const sinkAccepted = runtime.runInNodeMode(
    (nodeRuntime: NodeRuntime<Config>) => {
      const response = postJson<Config, IngestResponse>(
        nodeRuntime,
        httpClient,
        apiKey,
        "/cre/runtime/ingest",
        {
          workflow: runtime.config.workflowName,
          kind: "feeds",
          idempotencyKey: digest,
          payload,
          source: "cre-runtime-reference-feeds",
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
      ...payload,
      digest,
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
