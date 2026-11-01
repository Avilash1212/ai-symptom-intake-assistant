// Local / single-server entry point. On Vercel, api/index.js is used instead.
import { config } from './config.js';
import { ready } from './db.js';
import { aiEnabled } from './ai.js';
import app from './app.js';

await ready();
app.listen(config.port, () => {
  console.log(`Symptom intake API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.databaseUrl ? 'Postgres (DATABASE_URL)' : `local PGlite at ${config.localDbDir}`}`);
  console.log(aiEnabled
    ? `AI: enabled (Gemini ${config.geminiModel})`
    : 'AI: GEMINI_API_KEY not set - using rule-based follow-ups and summaries');
});
