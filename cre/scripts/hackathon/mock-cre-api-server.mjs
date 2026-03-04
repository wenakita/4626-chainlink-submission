#!/usr/bin/env node

import { createServer } from 'node:http';

const HOST = process.env.CRE_MOCK_API_HOST ?? '127.0.0.1';
const PORT = Number(process.env.CRE_MOCK_API_PORT ?? '8789');
const API_KEY = process.env.CRE_MOCK_API_KEY ?? process.env.KEEPR_API_KEY_VALUE ?? 'local-test-key';

const MOCK_VAULT = {
  vaultAddress: '0xA015954E2606d08967Aee3787456bB3A86a46A42',
  chainId: 8453,
  creatorCoinAddress: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
  gaugeControllerAddress: '0xB471B53cD0A30289Bc3a2dc3c6dd913288F8baA1',
  burnStreamAddress: '',
  groupId: 'mock-group-1',
};
const RUNTIME_RECORDS = [];
const RUNTIME_RECORD_KEYS = new Set();
const RUNTIME_DECISIONS = [];
const RUNTIME_DECISION_KEYS = new Set();
const ENQUEUED_ACTIONS = [];
let NEXT_RUNTIME_RECORD_ID = 1;
let NEXT_RUNTIME_DECISION_ID = 1;
let NEXT_ACTION_ID = 1;

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function parseMaybeBase64Json(input) {
  if (!input) return null;
  const asText = input.toString('utf8');
  try {
    return JSON.parse(asText);
  } catch {}
  try {
    return JSON.parse(Buffer.from(asText, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function deriveVerdictFromAlerts(alerts) {
  if (!Array.isArray(alerts)) return 'unknown';
  if (alerts.some((a) => a?.severity === 'critical')) return 'critical';
  if (alerts.some((a) => a?.severity === 'warning' || a?.severity === 'info')) return 'watch';
  return 'pass';
}

function nonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSafePositiveInt(value, fallback, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

const server = createServer((req, res) => {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const auth = req.headers.authorization ?? '';

  if (path === '/healthz') {
    return sendJson(res, 200, { ok: true });
  }

  if (auth !== `Bearer ${API_KEY}`) {
    return sendJson(res, 401, { success: false, error: 'Unauthorized' });
  }

  if (method === 'GET' && path === '/api/cre/vaults/active') {
    return sendJson(res, 200, {
      success: true,
      data: { vaults: [MOCK_VAULT] },
    });
  }

  if (method === 'GET' && path === '/api/keepr/actions/pending') {
    return sendJson(res, 200, {
      success: true,
      data: { actions: ENQUEUED_ACTIONS, count: ENQUEUED_ACTIONS.length },
    });
  }

  if (method === 'GET' && path === '/api/cre/runtime/ingest') {
    const kind = nonEmptyString(url.searchParams.get('kind'));
    const limit = toSafePositiveInt(url.searchParams.get('limit'), 20);
    const filtered = kind ? RUNTIME_RECORDS.filter((entry) => entry.kind === kind) : RUNTIME_RECORDS;
    const records = filtered.slice(0, limit).map((entry) => ({
      id: entry.id,
      workflow: entry.workflow,
      kind: entry.kind,
      idempotencyKey: entry.idempotencyKey,
      payload: entry.payload,
      source: entry.source,
      correlationId: entry.correlationId,
      createdAt: entry.createdAt,
    }));

    return sendJson(res, 200, {
      success: true,
      data: { records, count: records.length },
    });
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const parsed = parseMaybeBase64Json(Buffer.concat(chunks));

    if (method === 'POST' && path === '/api/cre/keeper/aiAssess') {
      const alerts = Array.isArray(parsed?.alerts) ? parsed.alerts : [];
      const verdict = deriveVerdictFromAlerts(alerts);
      return sendJson(res, 200, {
        success: true,
        data: {
          enabled: true,
          verdict,
          confidence: verdict === 'critical' ? 0.93 : verdict === 'watch' ? 0.8 : 0.72,
          summary: `Mock AI assessed ${alerts.length} deterministic alert(s).`,
          suggestedAction:
            verdict === 'critical'
              ? 'Pause keeper-triggered writes and investigate immediately.'
              : 'Continue monitoring and review warnings.',
          provider: 'mock-ai',
        },
      });
    }

    if (method === 'POST' && path.startsWith('/api/cre/keeper/')) {
      return sendJson(res, 200, {
        success: true,
        data: { ok: true, endpoint: path, payload: parsed ?? {} },
      });
    }

    if (method === 'POST' && path === '/api/cre/runtime/ingest') {
      const workflow = nonEmptyString(parsed?.workflow);
      const kind = nonEmptyString(parsed?.kind);
      const idempotencyKey = nonEmptyString(parsed?.idempotencyKey);
      if (!workflow || !kind || !idempotencyKey) {
        return sendJson(res, 400, {
          success: false,
          error: 'workflow, kind, and idempotencyKey are required',
        });
      }

      const recordKey = `${workflow}:${kind}:${idempotencyKey}`;
      const inserted = !RUNTIME_RECORD_KEYS.has(recordKey);
      if (inserted) {
        const correlationId = nonEmptyString(req.headers['x-correlation-id']) ?? `mock-corr-${Date.now()}`;
        RUNTIME_RECORDS.unshift({
          id: NEXT_RUNTIME_RECORD_ID++,
          workflow,
          kind,
          idempotencyKey,
          payload:
            parsed?.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)
              ? parsed.payload
              : {},
          source: nonEmptyString(parsed?.source) ?? 'cre',
          correlationId,
          createdAt: new Date().toISOString(),
        });
        RUNTIME_RECORD_KEYS.add(recordKey);
      }

      return sendJson(res, 200, {
        success: true,
        data: { stored: true, inserted, idempotencyKey },
      });
    }

    if (method === 'POST' && path === '/api/cre/runtime/decisions') {
      const workflow = nonEmptyString(parsed?.workflow);
      const idempotencyKey = nonEmptyString(parsed?.idempotencyKey);
      const decision =
        parsed?.decision && typeof parsed.decision === 'object' && !Array.isArray(parsed.decision)
          ? parsed.decision
          : null;

      if (!workflow || !idempotencyKey || !decision) {
        return sendJson(res, 400, {
          success: false,
          error: 'workflow, idempotencyKey, and decision are required',
        });
      }

      const decisionKey = `${workflow}:${idempotencyKey}`;
      const inserted = !RUNTIME_DECISION_KEYS.has(decisionKey);
      if (inserted) {
        const correlationId = nonEmptyString(req.headers['x-correlation-id']) ?? `mock-corr-${Date.now()}`;
        RUNTIME_DECISIONS.unshift({
          id: NEXT_RUNTIME_DECISION_ID++,
          workflow,
          idempotencyKey,
          decision,
          status: nonEmptyString(parsed?.status) ?? 'stored',
          correlationId,
          createdAt: new Date().toISOString(),
        });
        RUNTIME_DECISION_KEYS.add(decisionKey);
      }

      let actionId;
      const enqueueAction = parsed?.enqueueAction;
      const isValidEnqueueAction =
        enqueueAction &&
        typeof enqueueAction === 'object' &&
        !Array.isArray(enqueueAction) &&
        nonEmptyString(enqueueAction.vaultAddress) &&
        nonEmptyString(enqueueAction.groupId) &&
        nonEmptyString(enqueueAction.actionType) &&
        enqueueAction.action &&
        typeof enqueueAction.action === 'object' &&
        !Array.isArray(enqueueAction.action);

      if (isValidEnqueueAction) {
        const dedupeKey = nonEmptyString(enqueueAction.dedupeKey);
        const alreadyQueued = dedupeKey
          ? ENQUEUED_ACTIONS.find((entry) => entry.dedupeKey === dedupeKey)
          : null;

        if (alreadyQueued) {
          actionId = alreadyQueued.id;
        } else {
          const queued = {
            id: NEXT_ACTION_ID++,
            vaultAddress: enqueueAction.vaultAddress,
            groupId: enqueueAction.groupId,
            actionType: enqueueAction.actionType,
            action: enqueueAction.action,
            dedupeKey: dedupeKey ?? null,
            createdAt: new Date().toISOString(),
            status: 'pending',
          };
          ENQUEUED_ACTIONS.push(queued);
          actionId = queued.id;
        }
      }

      return sendJson(res, 200, {
        success: true,
        data: {
          stored: true,
          inserted,
          idempotencyKey,
          ...(typeof actionId === 'number' ? { actionId } : {}),
        },
      });
    }

    if (method === 'POST' && path === '/api/keepr/actions/enqueue') {
      const dedupeKey = nonEmptyString(parsed?.dedupeKey);
      const existing = dedupeKey ? ENQUEUED_ACTIONS.find((entry) => entry.dedupeKey === dedupeKey) : null;
      if (existing) {
        return sendJson(res, 200, {
          success: true,
          data: { actionId: existing.id, inserted: false },
        });
      }

      const action = {
        id: NEXT_ACTION_ID++,
        vaultAddress: parsed?.vaultAddress ?? '',
        groupId: parsed?.groupId ?? '',
        actionType: parsed?.actionType ?? 'mock_action',
        action:
          parsed?.action && typeof parsed.action === 'object' && !Array.isArray(parsed.action)
            ? parsed.action
            : {},
        dedupeKey: dedupeKey ?? null,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      ENQUEUED_ACTIONS.push(action);
      return sendJson(res, 200, {
        success: true,
        data: { actionId: action.id, inserted: true },
      });
    }

    if (method === 'POST' && path === '/api/keepr/actions/updateStatus') {
      return sendJson(res, 200, {
        success: true,
        data: { updated: true },
      });
    }

    if (method === 'POST' && path === '/api/keepr/actions/execute') {
      return sendJson(res, 200, {
        success: true,
        data: {
          executed: true,
          retryable: false,
          actionType: parsed?.actionType ?? 'mock_action',
        },
      });
    }

    return sendJson(res, 404, { success: false, error: 'Not found' });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock-cre-api] listening on http://${HOST}:${PORT}`);
});
