import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProd) {
    throw new Error('JWT_SECRET (min 32 chars) must be set in production.');
  }
  jwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn('[config] JWT_SECRET not set - using an ephemeral secret. Sessions reset on restart.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 3001,
  jwtSecret,
  // Hosted Postgres (Supabase). Vercel's Supabase integration sets POSTGRES_URL.
  // When neither is set, an embedded local Postgres (PGlite) is used for development.
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  localDbDir: path.join(ROOT_DIR, 'server', 'data', 'pglite'),
  isVercel: Boolean(process.env.VERCEL),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  clientDist: path.join(ROOT_DIR, 'client', 'dist'),
  doctorSessionHours: 8,
  patientSessionHours: 2,
};
