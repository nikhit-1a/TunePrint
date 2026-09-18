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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const ACR_HOST = process.env.ACR_HOST;
const ACR_ACCESS_KEY = process.env.ACR_ACCESS_KEY;
const ACR_ACCESS_SECRET = process.env.ACR_ACCESS_SECRET;

if (!DEEPGRAM_API_KEY) {
  console.warn('Warning: DEEPGRAM_API_KEY is not set. Add it to your .env file.');
}
if (!ACR_HOST || !ACR_ACCESS_KEY || !ACR_ACCESS_SECRET) {
  console.warn('Warning: ACR_HOST / ACR_ACCESS_KEY / ACR_ACCESS_SECRET are not set. Add them to your .env file.');
}
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/identify', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file received. Send it as multipart/form-data under the field name "audio".' });
    }

    // Define the Deepgram + iTunes pipeline
    const runLyricsSearch = async () => {
      const deepgramRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/wav'
        },
        body: req.file.buffer
      });

      if (!deepgramRes.ok) throw new Error('Deepgram transcription failed');
      const deepgramData = await deepgramRes.json();
      const transcript = deepgramData.results?.channels[0]?.alternatives[0]?.transcript || '';

      if (!transcript.trim()) return { transcript: '', matches: [] };

      const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(transcript)}&entity=song&limit=3`);
      if (!itunesRes.ok) throw new Error('iTunes API failed');
      const itunesData = await itunesRes.json();

      const matches = itunesData.results.map(track => ({
        title: track.trackName,
        artist: track.artistName,
        album: track.collectionName,
        cover: track.artworkUrl100,
        source: 'Lyrics'
      }));

      return { transcript, matches };
    };

    // Define the ACRCloud pipeline
    const runMelodySearch = async () => {
      if (!ACR_HOST || !ACR_ACCESS_KEY || !ACR_ACCESS_SECRET) return { matches: [] };

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
      form.append('recognize_type', 'both');

      const acrRes = await fetch(`https://${ACR_HOST}/v1/identify`, {
        method: 'POST',
        body: form,
      });

      if (!acrRes.ok) throw new Error('ACRCloud request failed');
      const data = await acrRes.json();

      const humResults = data?.metadata?.humming || data?.metadata?.music || [];
      const matches = [];

      const cjkRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;
      for (const result of humResults) {
        const title = result.title || '';
        const artist = result.artists?.[0]?.name || '';
        if (!cjkRegex.test(title) && !cjkRegex.test(artist)) {
          matches.push({
            title: title,
            artist: artist,
            album: result.album?.name,
            score: result.score ? Math.round(parseFloat(result.score) * 100) : null,
            source: 'Melody'
          });
          if (matches.length >= 3) break;
        }
      }
      return { matches };
    };

    // Run both engines concurrently (ignoring failures)
    const [lyricsResult, melodyResult] = await Promise.allSettled([
      runLyricsSearch(),
      runMelodySearch()
    ]);

    const transcript = lyricsResult.status === 'fulfilled' ? lyricsResult.value.transcript : '';
    let finalMatches = [];

    // Add melody matches first (usually more confident if it hits)
    if (melodyResult.status === 'fulfilled') {
      finalMatches.push(...melodyResult.value.matches);
    }

    // Add lyrics matches, filtering out duplicates
    if (lyricsResult.status === 'fulfilled') {
      for (const lyricMatch of lyricsResult.value.matches) {
        const isDuplicate = finalMatches.some(m => 
          m.title.toLowerCase() === lyricMatch.title.toLowerCase() && 
          m.artist.toLowerCase() === lyricMatch.artist.toLowerCase()
        );
        if (!isDuplicate) {
          finalMatches.push(lyricMatch);
        }
      }
    }

    return res.json({ transcript, matches: finalMatches });
  } catch (err) {
    console.error('Identify error:', err);
    return res.status(500).json({ error: 'Recognition failed', detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Tuneprint backend running on port ${PORT}`));
