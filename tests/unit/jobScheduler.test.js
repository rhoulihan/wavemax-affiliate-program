// Background (cron) jobs must run on exactly ONE instance in an HA / multi-box
// deployment, or cron work (payment verification, reminder emails) double-executes.
// startBackgroundJobs() gates this on the RUN_BACKGROUND_JOBS env var: it starts the
// jobs ONLY when RUN_BACKGROUND_JOBS === 'true' (strict), and is a no-op otherwise.
const { startBackgroundJobs } = require('../../server/jobs/scheduler');

describe('background-job scheduler gating (RUN_BACKGROUND_JOBS)', () => {
  const makeJob = () => ({ start: jest.fn().mockResolvedValue(undefined) });
  const silentLog = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

  test('does NOT start jobs when the flag is unset', async () => {
    const job = makeJob();
    const started = await startBackgroundJobs({ env: {}, log: silentLog, paymentVerificationJob: job });
    expect(started).toBe(false);
    expect(job.start).not.toHaveBeenCalled();
  });

  test("does NOT start jobs when the flag is 'false'", async () => {
    const job = makeJob();
    const started = await startBackgroundJobs({ env: { RUN_BACKGROUND_JOBS: 'false' }, log: silentLog, paymentVerificationJob: job });
    expect(started).toBe(false);
    expect(job.start).not.toHaveBeenCalled();
  });

  test("starts jobs exactly once when the flag === 'true'", async () => {
    const job = makeJob();
    const started = await startBackgroundJobs({ env: { RUN_BACKGROUND_JOBS: 'true' }, log: silentLog, paymentVerificationJob: job });
    expect(started).toBe(true);
    expect(job.start).toHaveBeenCalledTimes(1);
  });

  test('strict match — non-"true" truthy-ish values stay disabled (prevents accidental dual-leader)', async () => {
    for (const v of ['TRUE', 'True', '1', 'yes', 'on', ' true ']) {
      const job = makeJob();
      const started = await startBackgroundJobs({ env: { RUN_BACKGROUND_JOBS: v }, log: silentLog, paymentVerificationJob: job });
      expect(started).toBe(false);
      expect(job.start).not.toHaveBeenCalled();
    }
  });
});
