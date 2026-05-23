/* eslint-env node */
import { validationResult } from 'express-validator'

export function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (errors.isEmpty()) return next()
  return res.status(400).json({
    error: 'Validation failed.',
    details: errors.array().map(({ path, msg, value }) => ({ field: path, msg, value })),
  })
}
