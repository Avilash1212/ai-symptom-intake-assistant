// Express 4 does not catch rejected promises from async handlers; this
// forwards them to the error middleware instead of crashing the request.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
