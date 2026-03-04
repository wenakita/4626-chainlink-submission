import type { VercelRequest, VercelResponse } from "@vercel/node"

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
} from "../../../../server/auth/_shared.js"
import {
  authenticateRuntimeRequest,
  executeCreHttpTrigger,
} from "../../../../server/_lib/cre/runtimeBridge.js"
import { logger } from "../../../../server/_lib/logger.js"

type TriggerBody = {
  workflowId?: string
  input?: Record<string, unknown>
  requestId?: string
}

type TriggerResponse = {
  accepted: boolean
  requestId: string
  statusCode: number
  gatewayUrl: string
  response: unknown
}

function parseAllowedWorkflowIds(): Set<string> {
  const raw = (process.env.CRE_RUNTIME_ALLOWED_TRIGGER_WORKFLOW_IDS ?? "").trim()
  if (!raw) return new Set<string>()
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => normalizeWorkflowId(value))
  return new Set<string>(values)
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeWorkflowId(raw: string): string {
  const cleaned = raw.startsWith("0x") ? raw.slice(2) : raw
  return cleaned.toLowerCase()
}

function isWorkflowId(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<TriggerBody>(req)) ?? {}
  const auth = await authenticateRuntimeRequest(req, body, {
    allowUnsignedWhenHmacConfigured: true,
  })
  if (!auth.ok) {
    return res.status(auth.status).json({
      success: false,
      error: auth.error,
    } satisfies ApiEnvelope<never>)
  }

  const workflowIdRaw = nonEmptyString(body.workflowId)
  const input = body.input && typeof body.input === "object" && !Array.isArray(body.input) ? body.input : null
  if (!workflowIdRaw || !input) {
    return res.status(400).json({
      success: false,
      error: "workflowId and input are required",
    } satisfies ApiEnvelope<never>)
  }

  const workflowId = normalizeWorkflowId(workflowIdRaw)
  if (!isWorkflowId(workflowId)) {
    return res.status(400).json({
      success: false,
      error: "workflowId must be a 64-character hex string",
    } satisfies ApiEnvelope<never>)
  }

  const allowedWorkflowIds = parseAllowedWorkflowIds()
  if (allowedWorkflowIds.size > 0 && !allowedWorkflowIds.has(workflowId)) {
    return res.status(403).json({
      success: false,
      error: "workflowId is not allowed",
    } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await executeCreHttpTrigger({
      workflowId,
      input,
      requestId: nonEmptyString(body.requestId) ?? undefined,
    })

    logger.info("CRE trigger dispatched", {
      workflowId,
      requestId: result.requestId,
      statusCode: result.statusCode,
      correlationId: auth.correlationId,
    })

    return res.status(result.ok ? 200 : 502).json({
      success: result.ok,
      data: {
        accepted: result.ok,
        requestId: result.requestId,
        statusCode: result.statusCode,
        gatewayUrl: result.gatewayUrl,
        response: result.response,
      },
      ...(result.ok ? {} : { error: "CRE gateway request failed" }),
    } satisfies ApiEnvelope<TriggerResponse>)
  } catch (error) {
    logger.error("CRE trigger error", { error, correlationId: auth.correlationId })
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    } satisfies ApiEnvelope<never>)
  }
}
