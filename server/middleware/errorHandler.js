/* eslint-env node */
import { ValidationError, UniqueConstraintError, DatabaseError } from 'sequelize'

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Route not found.' })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof UniqueConstraintError) {
    return res.status(409).json({
      error: 'Resource already exists.',
      details: err.errors?.map((e) => ({ field: e.path, msg: e.message })) || [],
    })
  }
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation failed.',
      details: err.errors?.map((e) => ({ field: e.path, msg: e.message })) || [],
    })
  }
  if (err instanceof DatabaseError) {
    console.error('[db]', err)
    return res.status(500).json({ error: 'Database error.' })
  }

  console.error('[server]', err)
  res.status(err.status || 500).json({
    error: err.expose ? err.message : 'Internal server error.',
  })
}
