/**
 * FlowSpeak Backend — server.js
 * Express API that bridges the NativeScript mobile app with:
 *   - Whisper.cpp  (speech-to-text)  at http://127.0.0.1:8080
 *   - Ollama LLM   (grammar eval)    at http://127.0.0.1:11434
 */

const express   = require('express');
const multer    = require('multer');
const axios     = require('axios');
const FormData  = require('form-data');
const fs        = require('fs');
const path      = require('path');

const cors        = require('cors');
const { execFile }  = require('child_process');

// ─── App Setup ───────────────────────────────────────────────────────────────

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file,  cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const audioFilter = (_req, file, cb) => {
  const allowed = [
    'audio/wav', 'audio/x-wav', 'audio/wave',
    'audio/mpeg', 'audio/mp3', 'audio/ogg',
    'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/3gpp',
    'application/octet-stream'
  ];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(wav|mp3|ogg|webm|m4a|aac|3gp|caf)$/i)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported audio format: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter: audioFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, 
});

function convertTo16kWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath], (error) => {
      if (error) return reject(error);
      resolve(outputPath);
    });
  });
}

function cleanupFile(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error(`[GC] Failed to delete ${filePath}:`, err.message);
    } else {
      console.log(`[GC] Deleted temp file: ${filePath}`);
    }
  });
}

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const tempPath = req.file?.path;
  let targetWavPath = null;

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file received. Use field name "audio".' });
  }

  try {
    console.log(`[Transcribe] Received: ${req.file.originalname} (${req.file.size} bytes)`);

    // Ensure 16kHz mono WAV format for Whisper.cpp
    targetWavPath = path.join(UPLOAD_DIR, `conv-${Date.now()}.wav`);
    await convertTo16kWav(tempPath, targetWavPath);

    // Build multipart payload for Whisper.cpp /inference endpoint
    const form = new FormData();
    form.append('file', fs.createReadStream(targetWavPath), {
      filename: 'audio.wav',
      contentType: 'audio/wav',
    });
    // Whisper.cpp server-side options (adjust as needed)
    form.append('temperature',   '0.0');
    form.append('temperature_inc', '0.2');
    form.append('response_format', 'json');

    const whisperRes = await axios.post('http://127.0.0.1:8080/inference', form, {
      headers: form.getHeaders(),
      timeout: 60_000, // allow up to 60 s for slow CPU inference
    });

    // Whisper.cpp returns { text: "..." } in json mode
    const transcript = (whisperRes.data?.text || '').trim();

    console.log(`[Transcribe] Result: "${transcript.slice(0, 80)}..."`);
    return res.json({ transcript });

  } catch (err) {
    console.error('[Transcribe] Error:', err.message);

    if (err.code === 'ECONNREFUSED') {
      return res.status(502).json({ error: 'Whisper.cpp server is not running at http://127.0.0.1:8080' });
    }
    if (err.response) {
      return res.status(502).json({ error: `Whisper.cpp returned ${err.response.status}`, detail: err.response.data });
    }
    return res.status(500).json({ error: err.message });

  } finally {
    // Always clean up both original and converted temp files
    cleanupFile(tempPath);
    cleanupFile(targetWavPath);
  }
});

// ─── POST /api/evaluate ──────────────────────────────────────────────────────
/**
 * Accepts: application/json { transcript: string }
 * Returns: { score, corrections, vocabulary_tips } (parsed from Ollama)
 *
 * Sends the transcript to the local Ollama LLM for grammar/vocabulary
 * evaluation and parses the structured JSON response.
 */
app.post('/api/evaluate', async (req, res) => {
  const { transcript } = req.body;

  const cleanTranscript = (transcript || '').replace(/\[BLANK_AUDIO\]/gi, '').trim();
  if (!cleanTranscript) {
    return res.status(400).json({ error: 'No spoken audio detected in recording.' });
  }

  const prompt = `You are an expert English teacher evaluating an Indonesian student's spoken English transcript.
    Analyze the transcript for grammatical errors, vocabulary usage, and fluency.
    Grade fluency, grammar, vocabulary, and overall score as numbers from 0 to 100 (where 100 is native fluency, 70-85 is good intermediate).
    Explain corrections and vocabulary tips in Indonesian (Bahasa Indonesia).

    Transcript to evaluate:
    "${cleanTranscript}"

    You MUST respond ONLY with a valid JSON object matching this exact schema:
    {
      "score": {
        "fluency": <number between 0-100>,
        "grammar": <number between 0-100>,
        "vocabulary": <number between 0-100>,
        "overall": <number between 0-100>
      },
      "corrections": [
        {
          "original": "<original error substring or clause>",
          "fixed": "<corrected clause>",
          "explanation": "<penjelasan perbaikan dalam bahasa Indonesia>"
        }
      ],
      "vocabulary_tips": [
        "<saran kata atau frasa yang lebih baik dalam bahasa Indonesia>"
      ]
    }`;

  try {
    console.log(`[Evaluate] Sending ${cleanTranscript.length} chars to Ollama...`);

    let ollamaRes;
    try {
      ollamaRes = await axios.post(
        'http://127.0.0.1:11434/api/generate',
        {
          model:  'llama3.2:1b',
          prompt,
          stream: false,
          format: 'json',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 120_000, // LLM on CPU can be slow — allow 2 min
        }
      );
    } catch (firstErr) {
      console.warn(`[Evaluate] First Ollama attempt failed (${firstErr.message}), retrying once...`);
      await new Promise(r => setTimeout(r, 1500));
      ollamaRes = await axios.post(
        'http://127.0.0.1:11434/api/generate',
        {
          model:  'llama3.2:1b',
          prompt,
          stream: false,
          format: 'json',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 120_000,
        }
      );
    }

    // Ollama wraps the model's output in { response: "..." }
    const rawResponse = ollamaRes.data?.response;

    let evaluation;
    try {
      evaluation = JSON.parse(rawResponse);
    } catch {
      console.error('[Evaluate] Ollama returned non-JSON:', rawResponse);
      return res.status(502).json({
        error: 'Ollama returned an invalid JSON response.',
        raw: rawResponse,
      });
    }

    // Defensive normalization: ensure scores are clean integers between 0 and 100
    if (evaluation?.score) {
      for (const k of ['fluency', 'grammar', 'vocabulary', 'overall']) {
        let val = Number(evaluation.score[k]);
        if (isNaN(val)) val = 70;
        // If model output 1-10 scale, convert to 10-100
        if (val > 0 && val <= 10) val = val * 10;
        evaluation.score[k] = Math.min(100, Math.max(0, Math.round(val)));
      }
    }

    console.log('[Evaluate] Score:', evaluation?.score);
    return res.json(evaluation);

  } catch (err) {
    console.error('[Evaluate] Error:', err.message);

    if (err.code === 'ECONNREFUSED') {
      return res.status(502).json({ error: 'Ollama is not running at http://127.0.0.1:11434' });
    }
    if (err.response) {
      return res.status(502).json({ error: `Ollama returned ${err.response.status}`, detail: err.response.data });
    }
    return res.status(500).json({ error: err.message });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'FlowSpeak API', version: '1.0.0' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  console.error('[Unhandled]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎙️  FlowSpeak API running on http://0.0.0.0:${PORT}`);
  console.log(`   POST /api/transcribe  →  Whisper.cpp @ http://127.0.0.1:8080`);
  console.log(`   POST /api/evaluate    →  Ollama      @ http://127.0.0.1:11434\n`);
});
