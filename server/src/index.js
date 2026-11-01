import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config.js';
import './db.js';
import { aiEnabled } from './ai.js';
import { patientRouter } from './routes/patient.js';
import { doctorRouter } from './routes/doctor.js';

const app = express();
app.disable('x-powered-by');
if (config.isProd) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// API responses contain health information: never cache them.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  // State-changing requests must be JSON, which a cross-site form cannot send.
  if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Expected application/json.' });
  }
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, aiEnabled }));
app.use('/api/patient', patientRouter);
app.use('/api/doctor', doctorRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { index: false }));
  app.get('*', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(config.port, () => {
  console.log(`Symptom intake API listening on http://localhost:${config.port}`);
  console.log(aiEnabled
    ? `AI: enabled (Gemini ${config.geminiModel})`
    : 'AI: GEMINI_API_KEY not set - using rule-based follow-ups and summaries');
});
