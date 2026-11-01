# AI Symptom Intake Assistant

An AI-powered symptom intake assistant designed to help patients communicate their symptoms and help doctors prepare for consultations through structured, AI-generated summaries.

## Overview

Collecting basic patient information can take up a significant portion of a doctor's consultation time. Patients often need to explain their symptoms, describe their duration and severity, and answer several routine questions before the actual consultation begins.

The AI Symptom Intake Assistant aims to streamline this process by collecting symptom information before the doctor consultation.

Patients interact with an AI assistant that asks standard questions and generates relevant follow-up questions based on their responses. Once the intake is complete, the application generates a structured symptom summary for the doctor to review.

**The product focuses on improving consultation preparation, not replacing medical professionals.**

## Problem Statement

- Doctors spend valuable consultation time collecting basic symptom information.
- Patients may forget or struggle to communicate important details about their symptoms.
- Information provided during consultations may not always be structured or easy to review.

## Solution

The application provides a structured AI-powered symptom intake workflow.

Patients describe their symptoms through text or voice, answer relevant questions, review the generated summary, and submit it for doctor review.

Doctors can log in to a dedicated dashboard and access submitted patient summaries before consultations.

## Key Features

### Patient Interface
- Separate patient entry point.
- Symptom description through text and voice input.
- Standard symptom-intake questions.
- AI-generated dynamic follow-up questions.
- Options such as "Not Applicable" and "Don't Know / Not Sure".
- AI-generated structured symptom summaries.
- Patient review and confirmation before submission.
- Like button and optional written feedback.

### Doctor Interface
- Dedicated doctor login.
- Secure doctor dashboard.
- List of submitted patient intakes.
- Individual patient symptom summaries.
- Access to original patient responses for clarification.

### AI Capabilities
- Context-aware follow-up question generation.
- Structured symptom information extraction.
- Summary generation based on patient responses.
- Avoidance of unsupported assumptions and invented information.
- Basic urgent-symptom escalation workflow.

## Application Workflow

1. Patient or doctor opens the application.
2. User selects their role.
3. Patients enter the symptom intake workflow.
4. AI asks standard questions and relevant follow-up questions.
5. Patient reviews and confirms the generated summary.
6. The submission becomes available on the doctor's dashboard.
7. Doctor reviews the summary before consultation.

## Product Metrics

The product is designed to measure improvements across two user groups.

**Patient-side metrics**
- Intake start rate.
- Question completion rate.
- Drop-off at each question.
- Summary generation rate.
- Summary submission rate.
- Patient feedback.

**Doctor-side metrics**
- Patients consulted per hour.
- Total patients consulted per day.
- Average consultation time for similar patient types.

These metrics can help evaluate whether the product improves workflow efficiency after introduction into a clinic.

## Technology Stack

- Frontend: React 18 with Vite and React Router
- Backend: Node.js with Express, run as a Vercel serverless function
- Database: PostgreSQL on Supabase (embedded PGlite for local development)
- AI Model/API: Google Gemini API (`gemini-3.6-flash`) with a rule-based fallback
- Voice Input: Browser Web Speech API (Chrome / Edge)
- Authentication: bcrypt-hashed passwords, signed JWT in httpOnly cookies, server-side role checks
- Deployment: Vercel

## Current Scope

This project is an early-stage MVP focused on the core symptom intake and doctor review workflow.

The following are outside the current scope:

- Disease diagnosis.
- Medication and treatment recommendations.
- Prescription generation.
- Historical patient records.
- Appointment scheduling.
- Billing and hospital management.
- Multi-language support.
- Advanced clinical analytics.

## Safety and Disclaimer

This application is an experimental prototype and is not a clinically validated medical device.

It does not diagnose medical conditions or recommend treatments. AI-generated summaries are intended to organise information provided by patients for review by qualified healthcare professionals.

Potential emergency symptoms should trigger appropriate urgent-care guidance. The prototype must undergo clinical, privacy and security review before real-world patient deployment.

## Future Improvements

Potential areas for future development include:

- Doctor feedback and clinical review workflows.
- Additional language support.
- Improved speech recognition.
- Formal AI evaluation and accuracy testing.
- Advanced clinic analytics.
- Integration with existing clinic systems.

## Project Status

MVP / Prototype

Built as an AI Product Management portfolio project to explore how AI can improve patient intake and doctor consultation preparation.

---

# Developer Guide

## Running locally

Requirements: Node.js 20+.

```bash
npm run install:all
```

```bash
cp .env.example .env
```

Edit `.env`: set `JWT_SECRET` to a long random string, and optionally add a free `GEMINI_API_KEY` from https://aistudio.google.com/apikey. Then create the doctor account, plus synthetic demo submissions:

```bash
npm run seed:demo
```

**Development** (two terminals, open http://localhost:5173):

```bash
npm run dev:server
```

```bash
npm run dev:client
```

**Single server** (builds the React app and serves it from Express on http://localhost:3001):

```bash
npm run build
```

```bash
npm start
```

The demo doctor login is set by `DOCTOR_EMAIL` / `DOCTOR_PASSWORD` in `.env`. Change these before showing the app to anyone, then run `npm run seed` again.

Locally, with `DATABASE_URL` empty, data is kept in an embedded Postgres database in `server/data/pglite`, so no database setup is needed. To develop against Supabase instead, put its connection string in `DATABASE_URL`.

## Deploying to Vercel (with Supabase)

The whole repo is deployed as **one Vercel project from the repository root**. Don't pick `client` or `server` as the root directory. `vercel.json` already sets everything up:
- The React app in `client/` is built and served as static files.
- The Express API in `server/` runs as a single serverless function (`api/index.js`) that handles every `/api/...` request.

**1. Create the database (Supabase, free plan)**
1. Sign in at https://supabase.com and create a new project. Save the database password it asks you to set.
2. Open the project, click **Connect**, and copy the **Transaction pooler** connection string (port `6543`). Replace `[YOUR-PASSWORD]` in it with your database password.

The app creates its tables automatically on first use.

**2. Import the project in Vercel**
1. In Vercel: **Add New… → Project**, then import your GitHub repository.
2. Leave **Root Directory** as `./` (the repository root) and **Framework Preset** as **Other**. The build and output settings come from `vercel.json`, so don't change them.
3. Under **Environment Variables**, add:

| Name | Value |
|---|---|
| `DATABASE_URL` | the Supabase Transaction pooler connection string |
| `JWT_SECRET` | a long random string (at least 32 characters) |
| `GEMINI_API_KEY` | your Gemini key |
| `GEMINI_MODEL` | `gemini-3.6-flash` |
| `DOCTOR_NAME` | e.g. `Dr. Demo` |
| `DOCTOR_EMAIL` | the doctor's login email |
| `DOCTOR_PASSWORD` | a strong password (at least 10 characters) |

4. Click **Deploy**.

On the first request, the doctor account is created from `DOCTOR_EMAIL` / `DOCTOR_PASSWORD`. Sign in at `https://<your-app>.vercel.app/doctor/login`. You can check that the API is running at `/api/health`.

If you add Supabase through Vercel's **Storage** tab instead, Vercel sets `POSTGRES_URL` for you. The app accepts that too, so `DATABASE_URL` isn't needed in that case.

**Optional: demo data on the live database.** Put the Supabase connection string in your local `.env` as `DATABASE_URL`, then run:

```bash
npm run seed:demo
```

**To change the doctor password later:** update `DOCTOR_PASSWORD` in your local `.env` (with `DATABASE_URL` pointing at Supabase), then run:

```bash
npm run seed
```

**Notes for serverless hosting:**
- Each request may run on a different instance, so the login rate limit is counted per instance.
- Gemini calls can take up to about 15 seconds. The function time limit is set to 60 seconds in `vercel.json`.

## AI mode vs. rule-based mode

- **With `GEMINI_API_KEY` set**, Google Gemini generates the follow-up questions and the summary as structured JSON. The default model is `gemini-3.6-flash`, which is on the free tier and answered in about 5 seconds in testing. You can change it with `GEMINI_MODEL`, for example to `gemini-3.5-flash-lite` for faster responses. In testing on a free key, `gemini-3.8-flash` did not respond at all, so it is not the default. Rate-limit (429) and temporary errors are retried once.
- **Without a key**, or if a Gemini call fails, is blocked or times out, a built-in rule-based engine generates symptom-specific follow-ups and a summary, so the intake never gets stuck. The server prints which mode is active on startup.
- **Free-tier privacy:** under Google's terms, content sent on the free tier may be used to improve Google's products. Only use synthetic test data. A real deployment would need the paid tier and a proper data-processing review.

The API key is read only by the server and is never sent to the browser.

## User journeys in detail

**Patient:** Landing → *I'm a patient* → describe symptoms (text or voice) → 4 standard questions → up to 2 rounds of AI follow-ups (max 8 questions, optional, can finish early) → review the summary and edit any answer → confirm → confirmation, Like button and optional written feedback → *Finish* clears the session from the computer.

**Doctor:** Landing → *I'm a doctor* → sign in → patient list (ID, submission time, status: New / Reviewed / Urgent) → open a patient → structured summary, original responses, optional consultation timer → **Metrics** page → log out.

Every question except the first offers **Not applicable**, **Don't know / Not sure**, and **Skip**. Each is stored as a separate response type, and the summary keeps "could not provide" apart from "not applicable".

## Safety design

- **Urgent symptoms.** Every free-text answer goes through a deterministic red-flag screen (`server/src/safety.js`) before any AI call. It covers chest pain, breathing difficulty, stroke signs, collapse or seizure, severe bleeding, anaphylaxis, self-harm, thunderclap headache, loss of bladder or bowel control and similar, with simple negation handling. The AI follow-up step can also flag urgency. When urgency is detected, the routine questions stop and the patient is told to alert staff or call emergency services (112). The server then refuses any further intake calls for that session, and the doctor dashboard shows the session as **Urgent – escalated**.
- **No diagnosis or advice.** The system prompt forbids diagnosis, causes, treatment, medication and reassurance. Patient text is wrapped as data, and the prompt says to ignore any instructions inside it.
- **No invented facts.** Duration, severity, body parts, pattern, and the lists of unanswered and not-applicable questions are filled in by code straight from the patient's answers. The LLM only extracts symptom phrases, picks informative follow-up answers and writes a neutral "Patient reports…" overview. Any follow-up answer it returns is checked against the questions that were actually asked.
- **Patient confirmation.** A summary can only be submitted when it is current. Editing any answer marks it stale until it is regenerated.

## Security and privacy

- Doctor routes and APIs need a signed, httpOnly, `SameSite=Strict` session cookie, which is checked **on the server** for every request (`requireDoctor`). The React route guard only controls what is shown. Typing `/doctor/...` without signing in redirects to the login page, and the APIs return 401.
- Each patient gets a cookie tied to exactly one intake session. Patient APIs never take a session ID from the URL, so a patient cannot reach another patient's data or any doctor data.
- Passwords are hashed with bcrypt. Login is rate-limited and returns the same response time whether or not the email exists.
- Other protections: Helmet security headers and a CSP, `Cache-Control: no-store` on all API responses, JSON-only requests that change data (blocks cross-site form posts), and a request size limit.
- No names, phone numbers or dates of birth are collected. Patients are identified by a random code such as `P-7K3Q9X`.
- On Vercel, HTTPS is automatic and cookies are marked `Secure`. For other hosts, deploy behind HTTPS with `NODE_ENV=production`.
- Voice input uses the browser's Web Speech API (Chrome or Edge). In Chrome, audio is processed by the browser vendor's speech service. Review this before any real-world use. Patients can always type instead.

## Metrics page

The **Metrics** page in the signed-in doctor area (`/doctor/metrics`) shows the product metrics listed above. Patients cannot access it. Builders with server access can print the same report from the command line with `npm run metrics` (add `-- --json` for JSON).

- **Patient journey:** intakes started and completed, urgent escalations, summaries generated and confirmed, questions answered, feedback count, and **Summary Generation Rate** (summaries generated ÷ intakes started × 100).
- **Drop-off by question:** for each question, how many patients reached it, answered it, skipped it, and left the intake there.
- **Doctor time, before vs. after the assistant:** patients per hour, patients per day, and average consultation time, each split by doctor-rated complexity (low/medium/high) so a change in case mix is visible. Faster consultations do not by themselves mean better outcomes.
- **Recent written feedback** from patients.

Consultations with the assistant are timed by the doctor from the patient page. Baseline timings from before the assistant can be entered on the Metrics page, or from the command line:

```bash
npm run metrics -- add-consultation --phase baseline --complexity low --start 2026-10-01T10:00 --minutes 12
```

## Project layout

```
api/index.js       Vercel serverless entry (wraps the Express app)
vercel.json        Vercel build, function and routing config
server/            Express API (Node, ESM)
  src/app.js         Express app; src/index.js starts it locally
  src/db.js          Postgres access (Supabase, or embedded PGlite locally)
  src/ai.js          Gemini calls + rule-based fallback
  src/safety.js      Emergency red-flag screen
  src/questions.js   Standard questions and limits
  src/routes/        patient.js, doctor.js
  src/analytics.js   Metrics queries
  scripts/seed.js    Doctor account + synthetic demo data
  scripts/metrics.js Command-line metrics report
  test/              node:test unit tests (npm test)
client/            React (Vite) app
  src/patient/       Intake, review, confirmation, urgent screens
  src/doctor/        Login, dashboard, patient view, metrics
```

Local data is stored in `server/data/pglite` (git-ignored). To reset it, delete the `server/data` folder and run `npm run seed:demo`.
