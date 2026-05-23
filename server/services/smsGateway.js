// Outbound SMS gateway: SSL Wireless BD primary, Twilio fallback.
// Returns { provider, messageId, dryRun? } on success; throws on hard failure.

const SSL_URL =
  process.env.SSL_SMS_API_URL || 'https://smsplus.sslwireless.com/api/v3/send-sms'

function pickProvider() {
  const explicit = (process.env.SMS_PROVIDER || '').toLowerCase()
  if (explicit === 'ssl' || explicit === 'twilio') return explicit
  if (process.env.SSL_SMS_API_TOKEN && process.env.SSL_SMS_SID) return 'ssl'
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return 'twilio'
  return 'dryrun'
}

function clientMessageId() {
  return `reliefops-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function sendViaSslWireless({ phone, message }) {
  const apiToken = process.env.SSL_SMS_API_TOKEN
  const sid = process.env.SSL_SMS_SID
  if (!apiToken || !sid) {
    throw new Error('SSL Wireless credentials missing (SSL_SMS_API_TOKEN/SSL_SMS_SID).')
  }

  const csmsId = clientMessageId()
  const response = await fetch(SSL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_token: apiToken,
      sid,
      msisdn: phone,
      sms: message,
      csms_id: csmsId,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  // SSL Wireless v3 returns { status: "SUCCESS", smsinfo: [...] } on success.
  const ok = response.ok && (payload.status === 'SUCCESS' || payload.status_code === 200)
  if (!ok) {
    const detail = payload.error_message || payload.message || `HTTP ${response.status}`
    throw new Error(`SSL Wireless rejected SMS: ${detail}`)
  }

  return {
    provider: 'ssl-wireless',
    messageId: payload.smsinfo?.[0]?.reference_id || csmsId,
  }
}

async function sendViaTwilio({ phone, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  if (!accountSid || !authToken || !from) {
    throw new Error(
      'Twilio credentials missing (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER).',
    )
  }

  const to = phone.startsWith('+') ? phone : `+${phone}`
  const body = new URLSearchParams({ From: from, To: to, Body: message })

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = payload.message || `HTTP ${response.status}`
    throw new Error(`Twilio rejected SMS: ${detail}`)
  }

  return { provider: 'twilio', messageId: payload.sid }
}

export async function sendSms({ phone, message }) {
  if (!phone || !message) {
    throw new Error('phone and message are required')
  }

  const primary = pickProvider()
  const errors = []

  if (primary === 'dryrun') {
    console.log(`[sms:dryrun] -> +${phone}: ${message}`)
    return { provider: 'dryrun', messageId: clientMessageId(), dryRun: true }
  }

  const order = primary === 'twilio' ? ['twilio', 'ssl'] : ['ssl', 'twilio']
  for (const provider of order) {
    try {
      if (provider === 'ssl') return await sendViaSslWireless({ phone, message })
      return await sendViaTwilio({ phone, message })
    } catch (error) {
      errors.push(`${provider}: ${error.message}`)
      console.warn(`[sms] ${provider} failed —`, error.message)
    }
  }

  throw new Error(`All SMS providers failed. ${errors.join(' | ')}`)
}
