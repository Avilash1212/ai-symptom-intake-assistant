# AI Symptom Intake Assistant – MVP

A web app for small clinics. Patients describe their symptoms (typed or spoken) and answer a short set of standard and AI-generated follow-up questions before their consultation. The doctor signs in and reads a structured summary of what the patient reported.

> **Early-stage prototype.** This is not a clinically validated medical device and must not be used for unsupervised clinical deployment. It does not diagnose, prescribe or recommend treatment. Use only synthetic data.

## Quick start

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

### AI mode vs. rule-based mode

- **With `GEMINI_API_KEY` set**, Google Gemini generates the follow-up questions and the summary as structured JSON. The default model is `gemini-3.6-flash`, which is on the free tier and answered in about 5 seconds in testing. You can change it with `GEMINI_MODEL`, for example to `gemini-3.5-flash-lite` for faster responses. In testing on a free key, `gemini-3.8-flash` did not respond at all, so it is not the default. Rate-limit (429) and temporary errors are retried once.
- **Without a key**, or if a Gemini call fails, is blocked or times out, a built-in rule-based engine generates symptom-specific follow-ups and a summary, so the intake never gets stuck. The server prints which mode is active on startup.
- **Free-tier privacy:** under Google's terms, content sent on the free tier may be used to improve Google's products. Only use synthetic test data. A real deployment would need the paid tier and a proper data-processing review.

The API key is read only by the server and is never sent to the browser.

## The two journeys

**Patient:** Landing → *I'm a patient* → describe symptoms (text or voice) → 4 standard questions → up to 2 rounds of AI follow-ups (max 8 questions, optional, can finish early) → review the summary and edit any answer → confirm → confirmation, Like button and optional written feedback → *Finish* clears the session from the computer.

**Doctor:** Landing → *I'm a doctor* → sign in → patient list (ID, submission time, status: New / Reviewed / Urgent) → open a patient → structured summary, original responses, optional consultation timer → **Metrics** page → log out.

Every question except the first offers **Not applicable**, **Don't know / Not sure**, and **Skip**. Each is stored as a separate response type, and the summary keeps "could not provide" apart from "not applicable".

## Safety design

- **Urgent symptoms.** Every free-text answer goes through a deterministic red-flag screen (`server/src/safety.js`) before any AI call. It covers chest pain, breathing difficulty, stroke signs, collapse or seizure, severe bleeding, anaphylaxis, self-harm, thunderclap headache and similar, with simple negation handling. The AI follow-up step can also flag urgency. When urgency is detected, the routine questions stop and the patient is told to alert staff or call emergency services (112). The server then refuses any further intake calls for that session, and the doctor dashboard shows the session as **Urgent – escalated**.
- **No diagnosis or advice.** The system prompt forbids diagnosis, causes, treatment, medication and reassurance. Patient text is wrapped as data, and the prompt says to ignore any instructions inside it.
- **No invented facts.** Duration, severity, body parts, pattern, and the lists of unanswered and not-applicable questions are filled in by code straight from the patient's answers. The LLM only extracts symptom phrases, picks informative follow-up answers and writes a neutral "Patient reports…" overview. Any follow-up answer it returns is checked against the questions that were actually asked.
- **Patient confirmation.** A summary can only be submitted when it is current. Editing any answer marks it stale until it is regenerated.

## Security and privacy

- Doctor routes and APIs need a signed, httpOnly, `SameSite=Strict` session cookie, which is checked **on the server** for every request (`requireDoctor`). The React route guard only controls what is shown. Typing `/doctor/...` without signing in redirects to the login page, and the APIs return 401.
- Each patient gets a cookie tied to exactly one intake session. Patient APIs never take a session ID from the URL, so a patient cannot reach another patient's data or any doctor data.
- Passwords are hashed with bcrypt. Login is rate-limited and returns the same response time whether or not the email exists.
- Other protections: Helmet security headers and a CSP, `Cache-Control: no-store` on all API responses, JSON-only requests that change data (blocks cross-site form posts), and a request size limit.
- No names, phone numbers or dates of birth are collected. Patients are identified by a random code such as `P-7K3Q9X`.
- Deploy behind HTTPS with `NODE_ENV=production` so cookies are marked `Secure`.
- Voice input uses the browser's Web Speech API (Chrome or Edge). In Chrome, audio is processed by the browser vendor's speech service. Review this before any real-world use. Patients can always type instead.

## Product analytics

The **Metrics** page in the signed-in doctor area (`/doctor/metrics`) shows the figures below. Patients cannot access it. Builders with server access can print the same report from the command line with `npm run metrics` (add `-- --json` for JSON).

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
server/            Express API (Node, ESM)
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

Data is stored in SQLite at `server/data/intake.db` (git-ignored). To reset it, delete the folder and run `npm run seed:demo`.

## Not in scope for the MVP

Diagnosis, medication or treatment recommendations, prescriptions, report interpretation, historical records, scheduling, billing, hospital management, multiple languages, advanced analytics and AI evaluation pipelines.
