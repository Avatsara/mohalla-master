const MAX_TEXT_LENGTH = 300;
const MAX_COORD_TEXT_LENGTH = 64;

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toSafeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function toCoordinateText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, MAX_COORD_TEXT_LENGTH);
}

function countDecimalPlaces(value) {
  const text = toCoordinateText(value);
  if (!text || !text.includes('.')) return 0;
  const decimals = text.split('.')[1] || '';
  return decimals.replace(/[^0-9]/g, '').length;
}

function normalizeBody(body) {
  if (!body) return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (_) {
      return null;
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch (_) {
      return null;
    }
  }
  if (typeof body === 'object') return body;
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const payload = normalizeBody(req.body);
  if (!payload) {
    return res.status(400).json({ ok: false, error: 'invalid_json' });
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : '';

  const record = {
    event: toSafeText(payload.event) || 'unknown',
    latitude: toFiniteNumber(payload.latitude),
    longitude: toFiniteNumber(payload.longitude),
    latitudeRaw: toCoordinateText(payload.latitudeRaw ?? payload.latitude),
    longitudeRaw: toCoordinateText(payload.longitudeRaw ?? payload.longitude),
    latitudeDecimalPlaces: countDecimalPlaces(payload.latitudeRaw ?? payload.latitude),
    longitudeDecimalPlaces: countDecimalPlaces(payload.longitudeRaw ?? payload.longitude),
    accuracyM: toFiniteNumber(payload.accuracyM),
    code: toFiniteNumber(payload.code),
    message: toSafeText(payload.message),
    capturedAt: toSafeText(payload.capturedAt),
    timezone: toSafeText(payload.timezone),
    locale: toSafeText(payload.locale),
    userAgent: toSafeText(payload.userAgent || req.headers['user-agent']),
    ip,
    receivedAt: new Date().toISOString(),
  };

  console.log('[location-log]', JSON.stringify(record));

  const webhookUrl = process.env.LOCATION_LOG_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const forwardRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (!forwardRes.ok) {
        console.error('[location-log] webhook_forward_failed', forwardRes.status);
      }
    } catch (err) {
      console.error('[location-log] webhook_forward_error', err);
    }
  }

  return res.status(202).json({ ok: true });
};
