'use strict';

const defaultLogger = require('../utils/logger');

/**
 * Conditionally start background (cron) jobs.
 *
 * In a multi-instance / HA deployment these MUST run on exactly ONE instance —
 * otherwise cron work (payment verification, reminder emails) double-executes
 * across boxes. Gate with the `RUN_BACKGROUND_JOBS` env var: set it to the exact
 * string `'true'` on the single designated leader instance; leave it unset or
 * any other value (the default) on every other instance. The match is strict on
 * purpose — only `'true'` enables jobs — so a stray `1`/`yes`/`TRUE` can't
 * accidentally create a second job-leader and re-introduce double execution.
 *
 * See docs/ops/HA-PHASE1-WEB.md (job-gating) for the HA rationale and the
 * planned Phase-1.5 upgrade to an Oracle-ADB leader-lease for job failover.
 *
 * @param {object} [opts]
 * @param {object} [opts.env=process.env]            environment to read the flag from
 * @param {object} [opts.log=logger]                 logger with info/error
 * @param {object} [opts.paymentVerificationJob]     injectable job (defaults to the real module)
 * @returns {Promise<boolean>} true if jobs were started, false if intentionally skipped
 */
async function startBackgroundJobs(opts = {}) {
  const env = opts.env || process.env;
  const log = opts.log || defaultLogger;

  if (env.RUN_BACKGROUND_JOBS !== 'true') {
    log.info('Background jobs disabled on this instance (RUN_BACKGROUND_JOBS != "true")');
    return false;
  }

  // eslint-disable-next-line global-require
  const paymentVerificationJob = opts.paymentVerificationJob || require('./paymentVerificationJob');
  await paymentVerificationJob.start();
  log.info('Background jobs ENABLED on this instance (RUN_BACKGROUND_JOBS="true")');
  return true;
}

module.exports = { startBackgroundJobs };
