// uploadW9 multer middleware (spec §6.2): field 'w9', memoryStorage,
// pdf/jpeg/png only, size cap from SystemConfig w9_max_upload_mb.
const express = require('express');
const request = require('supertest');
const SystemConfig = require('../../server/models/SystemConfig');
const uploadW9 = require('../../server/middleware/uploadW9');

function makeApp() {
  const app = express();
  app.post('/upload', uploadW9, (req, res) => {
    res.status(200).json({
      success: true,
      received: !!req.file,
      mimetype: req.file ? req.file.mimetype : null,
      size: req.file ? req.file.size : null
    });
  });
  return app;
}

describe('uploadW9 middleware', () => {
  it.each([
    ['application/pdf', '%PDF-1.4 test'],
    ['image/jpeg', '\xff\xd8\xff fakejpeg'],
    ['image/png', '\x89PNG fakepng']
  ])('accepts %s and exposes req.file from memoryStorage', async (contentType, body) => {
    const res = await request(makeApp())
      .post('/upload')
      .attach('w9', Buffer.from(body, 'binary'), { filename: 'w9.bin', contentType });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.mimetype).toBe(contentType);
  });

  it('rejects SVG with 400 W9_INVALID_FILE_TYPE', async () => {
    const res = await request(makeApp())
      .post('/upload')
      .attach('w9', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        { filename: 'w9.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('W9_INVALID_FILE_TYPE');
  });

  it('rejects an oversized file with 400 W9_FILE_TOO_LARGE (cap from w9_max_upload_mb)', async () => {
    await SystemConfig.findOneAndUpdate(
      { key: 'w9_max_upload_mb' },
      {
        $set: { value: 1, defaultValue: 1 },
        $setOnInsert: {
          description: 'W-9 upload size cap (MB)', category: 'payment',
          dataType: 'number', validation: { min: 1, max: 25 }
        }
      },
      { upsert: true }
    );
    const big = Buffer.alloc(Math.floor(1.5 * 1024 * 1024), 0x41);
    const res = await request(makeApp())
      .post('/upload')
      .attach('w9', big, { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('W9_FILE_TOO_LARGE');
  });

  it('passes non-multipart requests through untouched (JSON registration path)', async () => {
    const res = await request(makeApp()).post('/upload').send();
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(false);
  });
});
