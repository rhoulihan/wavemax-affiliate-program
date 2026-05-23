// Oracle ADB MongoDB-API cursor diagnostics capture.
//
// The Oracle Database API for MongoDB intermittently returns a `find`/`getMore`
// reply MISSING the required `cursor` envelope, which the mongodb 6.x driver
// rejects with `MongoUnexpectedServerResponseError: BSON element "cursor" is
// missing`. This module attaches command + connection-pool monitoring to a
// MongoClient and, on each occurrence, writes a structured, PII-free record to a
// dedicated log so the Oracle team has irrefutable evidence: the exact command,
// the malformed reply's shape, the backend node (address/serviceId), and the age
// of the connection it happened on.
//
// Read-only observation (monitorCommands). Gated by env so it can be turned off
// after enough data is gathered: set ORACLE_DIAG=false to disable.

const fs = require('fs');
const path = require('path');

const CURSOR_CMDS = new Set(['find', 'getMore', 'aggregate', 'listCollections', 'listIndexes']);

/**
 * True when an event represents the Oracle "cursor is missing" anomaly.
 * @param {'succeeded'|'failed'} kind
 * @param {string} commandName
 * @param {object} replyOrFailure  reply doc (succeeded) or error (failed)
 */
function isCursorAnomaly(kind, commandName, replyOrFailure) {
  if (!commandName || !CURSOR_CMDS.has(commandName)) return false;
  if (kind === 'succeeded') {
    return !!replyOrFailure && !replyOrFailure.cursor;
  }
  if (kind === 'failed') {
    const msg = (replyOrFailure && replyOrFailure.message) || '';
    return /cursor.*is missing|BSON element .?cursor.? is missing|MongoUnexpectedServerResponseError/i.test(msg);
  }
  return false;
}

function keysOf(obj) {
  try { return obj && typeof obj === 'object' ? Object.keys(obj) : []; } catch (_) { return []; }
}

/**
 * Build a redacted diagnostic record. Pure function (no I/O).
 */
function buildAnomalyRecord(o) {
  const started = o.started || {};
  const cmd = started.command || {};
  const reply = o.reply || null;
  const rec = {
    ts: new Date().toISOString(),
    label: o.label || 'mongo',
    kind: o.kind,                                   // 'malformed-reply' | 'command-failed'
    driver: o.driverVersion || null,
    commandName: started.commandName || null,
    ns: cmd[started.commandName] || cmd.find || cmd.getMore || cmd.aggregate || null, // the collection
    filterKeys: keysOf(cmd.filter || cmd.query),
    options: {
      limit: cmd.limit,
      batchSize: cmd.batchSize,
      singleBatch: cmd.singleBatch,
      projection: cmd.projection ? keysOf(cmd.projection) : undefined,
      sort: cmd.sort ? keysOf(cmd.sort) : undefined,
      collation: cmd.collation ? true : undefined,
      maxTimeMS: cmd.maxTimeMS,
      readConcern: cmd.readConcern && (cmd.readConcern.level || true),
      readPreference: cmd.$readPreference && (cmd.$readPreference.mode || true)
    },
    address: started.address || null,               // which ADB backend node
    serviceId: started.serviceId || null,           // loadBalanced service id
    connectionId: started.connectionId != null ? started.connectionId : null,
    connectionAgeMS: o.connAgeMS != null ? o.connAgeMS : null,
    requestId: started.requestId != null ? started.requestId : null,
    operationId: started.operationId != null ? started.operationId : null,
    durationMS: o.durationMS != null ? o.durationMS : null
  };
  if (reply) {
    rec.hasCursor = !!reply.cursor;
    rec.replyKeys = keysOf(reply);                  // top-level keys of the malformed reply
    rec.replyOk = reply.ok;
    if (reply.code != null) rec.replyCode = reply.code;
    if (reply.codeName) rec.replyCodeName = reply.codeName;
    if (reply.errmsg) rec.error = String(reply.errmsg).slice(0, 300);
  }
  if (o.failure) rec.error = String(o.failure.message || o.failure).slice(0, 300);
  return rec;
}

/**
 * Attach command + connection-pool monitoring to a MongoClient and write
 * anomaly records via `write(record)`. Returns a stats object + stop().
 *
 * @param {object} opts
 * @param {object} opts.client       a connected MongoClient (monitorCommands:true)
 * @param {string} [opts.label]      'mongoose' | 'connect-mongo'
 * @param {Function} opts.write      (record) => void  — sink for anomaly records
 * @param {object} [opts.logger]
 * @param {string} [opts.driverVersion]
 */
function installOracleDiagnostics(opts = {}) {
  const client = opts.client;
  const label = opts.label || 'mongo';
  const write = opts.write || (() => {});
  const logger = opts.logger || null;
  const driverVersion = opts.driverVersion
    // eslint-disable-next-line global-require
    || (() => { try { return require('mongodb/package.json').version; } catch (_) { return null; } })();
  if (!client || typeof client.on !== 'function') throw new Error('installOracleDiagnostics requires a MongoClient');

  const stats = { total: 0, byNs: {}, byAddress: {}, byCommand: {}, startedAt: new Date().toISOString() };
  const started = new Map();        // requestId -> started info (short-lived)
  const connCreatedAt = new Map();  // connectionId -> epoch ms

  client.on('connectionCreated', (e) => { try { connCreatedAt.set(e.connectionId, Date.now()); } catch (_) { /* ignore */ } });
  client.on('connectionClosed', (e) => { try { connCreatedAt.delete(e.connectionId); } catch (_) { /* ignore */ } });

  client.on('commandStarted', (e) => {
    if (!CURSOR_CMDS.has(e.commandName)) return;
    started.set(e.requestId, {
      commandName: e.commandName, command: e.command, address: e.address,
      serviceId: e.serviceId, connectionId: e.connectionId, requestId: e.requestId, operationId: e.operationId
    });
    // bound the cache
    if (started.size > 500) { const k = started.keys().next().value; started.delete(k); }
  });

  function finalize(e, kind, replyOrFailure) {
    const s = started.get(e.requestId);
    started.delete(e.requestId);
    if (!isCursorAnomaly(kind, e.commandName, replyOrFailure)) return;
    const createdAt = s && connCreatedAt.get(s.connectionId);
    const rec = buildAnomalyRecord({
      kind: kind === 'succeeded' ? 'malformed-reply' : 'command-failed',
      started: s || { commandName: e.commandName, command: {}, address: e.address, serviceId: e.serviceId, connectionId: e.connectionId, requestId: e.requestId },
      reply: kind === 'succeeded' ? replyOrFailure : null,
      failure: kind === 'failed' ? replyOrFailure : null,
      connAgeMS: createdAt ? (Date.now() - createdAt) : null,
      durationMS: e.duration,
      driverVersion, label
    });
    stats.total += 1;
    stats.byNs[rec.ns] = (stats.byNs[rec.ns] || 0) + 1;
    stats.byAddress[rec.address] = (stats.byAddress[rec.address] || 0) + 1;
    stats.byCommand[rec.commandName] = (stats.byCommand[rec.commandName] || 0) + 1;
    try { write(rec); } catch (err) { if (logger && logger.error) logger.error('Oracle diag write failed:', err.message); }
  }

  client.on('commandSucceeded', (e) => { try { finalize(e, 'succeeded', e.reply); } catch (_) { /* ignore */ } });
  client.on('commandFailed', (e) => { try { finalize(e, 'failed', e.failure); } catch (_) { /* ignore */ } });

  if (logger && logger.info) logger.info(`Oracle cursor diagnostics attached (${label}, driver ${driverVersion})`);
  return { stats, stop: () => { started.clear(); connCreatedAt.clear(); } };
}

/**
 * A file-appending sink (JSON-lines) for anomaly records.
 */
function fileWriter(logPath) {
  return function write(rec) {
    try { fs.appendFileSync(logPath, JSON.stringify(rec) + '\n'); } catch (_) { /* best-effort */ }
  };
}

module.exports = { isCursorAnomaly, buildAnomalyRecord, installOracleDiagnostics, fileWriter, _path: path };
