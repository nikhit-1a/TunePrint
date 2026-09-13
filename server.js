import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // ACRCloud caps sample size at 5MB
});

const ACR_HOST = process.env.ACR_HOST;               // e.g. identify-eu-west-1.acrcloud.com
const ACR_ACCESS_KEY = process.env.ACR_ACCESS_KEY;
const ACR_ACCESS_SECRET = process.env.ACR_ACCESS_SECRET;

if (!ACR_HOST || !ACR_ACCESS_KEY || !ACR_ACCESS_SECRET) {
  console.warn('Warning: ACR_HOST / ACR_ACCESS_KEY / ACR_ACCESS_SECRET are not set. Add them to your .env file.');
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/identify', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file received. Send it as multipart/form-data under the field name "audio".' });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = ['POST', '/v1/identify', ACR_ACCESS_KEY, 'audio', '1', timestamp].join('\n');
    const signature = crypto
      .createHmac('sha1', ACR_ACCESS_SECRET)
      .update(stringToSign, 'utf8')
      .digest('base64');

    const form = new FormData();
    form.append('sample', new Blob([req.file.buffer]), 'sample.wav');
    form.append('sample_bytes', req.file.buffer.length.toString());
    form.append('access_key', ACR_ACCESS_KEY);
    form.append('data_type', 'audio');
    form.append('signature_version', '1');
    form.append('signature', signature);
    form.append('timestamp', timestamp);

    const acrRes = await fetch(`https://${ACR_HOST}/v1/identify`, {
      method: 'POST',
      body: form,
    });

    const data = await acrRes.json();

    if (!acrRes.ok) {
      console.error('ACRCloud error response:', data);
      return res.status(acrRes.status).json({ error: 'ACRCloud request failed', detail: data });
    }

    return res.json(data);
  } catch (err) {
    console.error('Identify error:', err);
    return res.status(500).json({ error: 'Recognition failed', detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Tuneprint backend running on port ${PORT}`));
