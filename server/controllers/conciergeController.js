'use strict';

/**
 * conciergeController.js — POST /api/concierge
 *
 * A LIVE, tightly-scoped Claude-backed concierge for WaveMAX Austin. It answers
 * ONLY questions about this one laundromat, using ONLY the FACTS in
 * conciergeFaq.js. Security posture:
 *   - The guardrailed system prompt (buildSystemPrompt) is sent as a cached
 *     system block. It is STATIC and never includes user input.
 *   - The untrusted user message goes in a `user` role turn — it is NEVER
 *     interpolated into the system prompt (prompt-injection isolation).
 *   - On any failure (missing key, SDK throw) we return a graceful canned
 *     decline (200) and never leak the key, stack traces, or raw errors.
 *   - Model is a fast Haiku tier; prompt caching marks the static system block.
 */

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const ControllerHelpers = require('../utils/controllerHelpers');
const { buildSystemPrompt } = require('../services/conciergeFaq');

const { asyncWrapper, sendError } = ControllerHelpers;

// ── Configuration ─────────────────────────────────────────────────────────
const MODEL = 'claude-haiku-4-5'; // latest fast Haiku tier (per claude-api skill)
const MAX_TOKENS = 300; // replies are 1–3 sentences; keep small
const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY_TURNS = 6; // last ~6 turns
const VALID_ROLES = new Set(['user', 'assistant']);

// Built once; static (no per-request data) so the SDK can prompt-cache it.
const SYSTEM_PROMPT = buildSystemPrompt();

// Canned graceful-decline reply used when we cannot produce a real answer.
// Never reveals why (no key, API error, etc.) — just points to the phone.
const FALLBACK_REPLY =
  'Sorry, I can\'t answer that right now — please call us at (512) 553-1674.';

// Lazily-constructed Anthropic client (so a missing key doesn't crash at load).
let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const Client = Anthropic.default || Anthropic;
  _client = new Client({ apiKey });
  return _client;
}

/**
 * Sanitize optional conversation history: keep only well-formed {role, content}
 * entries with a valid role and a non-empty string content, cap content length,
 * and keep just the last MAX_HISTORY_TURNS. Anything malformed is dropped.
 * @param {*} history
 * @returns {Array<{role:string, content:string}>}
 */
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const clean = [];
  for (const turn of history) {
    if (!turn || typeof turn !== 'object') continue;
    if (!VALID_ROLES.has(turn.role)) continue;
    if (typeof turn.content !== 'string') continue;
    const content = turn.content.trim();
    if (!content) continue;
    clean.push({ role: turn.role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  return clean.slice(-MAX_HISTORY_TURNS);
}

/** Collapse runs of whitespace and trim — normalizes the model's reply. */
function normalizeReply(text) {
  return String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
}

/** Extract the concatenated text from an Anthropic Messages response. */
function extractText(response) {
  if (!response || !Array.isArray(response.content)) return '';
  return response.content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join(' ');
}

/**
 * POST /api/concierge
 * Body: { message: string, history?: [{role,content}] }
 * Returns: { reply: string }  (200 on success AND on graceful failure)
 */
exports.handle = asyncWrapper(async (req, res) => {
  const body = req.body || {};

  // ── Validate the message (untrusted) ──────────────────────────────────
  const raw = body.message;
  if (typeof raw !== 'string') {
    return sendError(res, 'A message is required.', 400);
  }
  const message = raw.trim();
  if (!message) {
    return sendError(res, 'A message is required.', 400);
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return sendError(res, 'Message is too long.', 400);
  }

  const history = sanitizeHistory(body.history);

  // ── Graceful decline if the API key is not configured ─────────────────
  const client = getClient();
  if (!client) {
    logger.warn('Concierge: ANTHROPIC_API_KEY not configured; returning fallback reply');
    return res.status(200).json({ reply: FALLBACK_REPLY });
  }

  // Build the message list: capped history, then the user message in a USER
  // turn. The untrusted message is NEVER placed in the system prompt.
  const messages = [
    ...history,
    { role: 'user', content: message }
  ];

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Static guardrailed system prompt as a cached block (prompt caching).
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
      ],
      messages
    });

    const reply = normalizeReply(extractText(response));
    return res.status(200).json({ reply: reply || FALLBACK_REPLY });
  } catch (err) {
    // Never leak the key, stack, or raw error to the client.
    logger.error('Concierge API call failed', { error: err && err.message });
    return res.status(200).json({ reply: FALLBACK_REPLY });
  }
});
