import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config.js';
import { describeDbError, doctorSetupStatus, ready } from './db.js';
import { ah } from './asyncHandler.js';
import { aiEnabled } from './ai.js';
import { patientRouter } from './routes/patient.js';
import { doctorRouter } from './routes/doctor.js';

// The Express app. Started as a normal server locally (src/index.js) and
// run as a single serverless function on Vercel (api/index.js).
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

// Reports whether the server can reach its database, in plain language,
// to make deployment problems easy to diagnose. Contains no secrets.
app.get('/api/health', async (req, res) => {
  try {
    await ready();
    res.json({ ok: true, database: 'connected', doctorAccount: doctorSetupStatus(), aiEnabled, jwtSecretSet: Boolean(process.env.JWT_SECRET) });
  } catch (err) {
    console.error('[health] database check failed:', err);
    res.status(503).json({ ok: false, database: describeDbError(err), aiEnabled, jwtSecretSet: Boolean(process.env.JWT_SECRET) });
  }
});
app.use('/api', ah(async (req, res, next) => {
  await ready();
  next();
}));
app.use('/api/patient', patientRouter);
app.use('/api/doctor', doctorRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Local single-server mode serves the built React app. On Vercel the static
// files are served by Vercel itself and never reach this function.
if (!config.isVercel && fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { index: false }));
  app.get('*', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default app;
