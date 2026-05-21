// Unit test for the ADB heartbeat's core query (keeps Always-Free ADB active).
const { heartbeat } = require('../../scripts/adb-heartbeat');

describe('adb-heartbeat', () => {
  it('issues a real read against systemconfigs to register DB activity', async () => {
    const findOne = jest.fn().mockResolvedValue({ _id: 'cfg' });
    const collection = jest.fn(() => ({ findOne }));
    const conn = { db: { collection } };

    await heartbeat(conn);

    expect(collection).toHaveBeenCalledWith('systemconfigs');
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('propagates a query failure so the cron run is marked failed', async () => {
    const findOne = jest.fn().mockRejectedValue(new Error('ADB unreachable'));
    const conn = { db: { collection: jest.fn(() => ({ findOne })) } };

    await expect(heartbeat(conn)).rejects.toThrow('ADB unreachable');
  });
});
