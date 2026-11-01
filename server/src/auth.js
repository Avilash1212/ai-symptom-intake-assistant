import jwt from 'jsonwebtoken';
import { config } from './config.js';

export const DOCTOR_COOKIE = 'sia_doctor';
export const PATIENT_COOKIE = 'sia_patient';

function cookieOptions(hours) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProd,
    maxAge: hours * 60 * 60 * 1000,
    path: '/api',
  };
}

function sign(payload, hours) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: `${hours}h` });
}

function verify(token, role) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return payload.role === role ? payload : null;
  } catch {
    return null;
  }
}

export function setDoctorCookie(res, doctor) {
  const token = sign({ role: 'doctor', sub: doctor.id }, config.doctorSessionHours);
  res.cookie(DOCTOR_COOKIE, token, cookieOptions(config.doctorSessionHours));
}

export function setPatientCookie(res, sessionId) {
  const token = sign({ role: 'patient', sid: sessionId }, config.patientSessionHours);
  res.cookie(PATIENT_COOKIE, token, cookieOptions(config.patientSessionHours));
}

export function clearCookie(res, name) {
  res.clearCookie(name, { path: '/api' });
}

// Server-side authorisation for every doctor API route.
export function requireDoctor(req, res, next) {
  const payload = verify(req.cookies?.[DOCTOR_COOKIE], 'doctor');
  if (!payload) return res.status(401).json({ error: 'Authentication required.' });
  req.doctorId = payload.sub;
  next();
}

// A patient token is bound to exactly one intake session; patient routes never
// take a session id from the URL, so one patient cannot reach another's data.
export function requirePatient(req, res, next) {
  const payload = verify(req.cookies?.[PATIENT_COOKIE], 'patient');
  if (!payload) return res.status(401).json({ error: 'No active intake session.' });
  req.sessionId = payload.sid;
  next();
}
