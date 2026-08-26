# API Documentation

## Overview

The Risk Scoring Authentication Engine provides a single REST API endpoint that analyzes login attempts and returns a risk score from 0-100.

## Base URL

**Development:** `http://localhost:3000`  
**Production:** `https://your-domain.vercel.app`

## Authentication

Currently, the API does not require authentication. In production, you should:
- Add API key authentication
- Use rate limiting
- Implement CORS restrictions

## Endpoint

### POST `/api/verify`

Verify a login attempt and get a risk score.

#### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "userId": "string (required)",
  "ipAddress": "string (required)",
  "deviceFingerprint": "string (required)",
  "userAgent": "string (required)",
  "timestamp": "string (optional, ISO 8601)"
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | Unique identifier for the user |
| `ipAddress` | string | Yes | IPv4 address of the login attempt |
| `deviceFingerprint` | string | Yes | Unique device fingerprint hash |
| `userAgent` | string | Yes | Browser user agent string |
| `timestamp` | string | No | ISO 8601 timestamp (defaults to current time) |

#### Response

**Status:** `200 OK`

**Body:**
```json
{
  "riskScore": 35,
  "recommendation": "monitor",
  "factors": ["new_device", "new_ip"],
  "explanation": "Risk factors: new device detected, new IP address. User allowed but flagged for monitoring.",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "success": true
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `riskScore` | number | Risk score from 0-100 |
| `recommendation` | enum | Action recommendation: `allow`, `monitor`, or `challenge` |
| `factors` | array | List of triggered risk factors |
| `explanation` | string | Human-readable explanation of the score |
| `requestId` | string | UUID for tracking this request |
| `success` | boolean | Whether the request was processed successfully |
| `error` | string | Error message (only present if `success: false`) |

## Risk Factors

The following factors can be included in the `factors` array:

| Factor | Description | Default Weight |
|--------|-------------|----------------|
| `new_device` | Device fingerprint never seen before | +20 |
| `new_ip` | IP address different from last 3 logins | +15 |
| `geo_impossible` | Geographic impossibility (>5000km in <1 hour) | +30 |
| `time_anomaly` | Login at unusual time for user | +10 |
| `bot_signals` | Bot-like user agent detected | +25 |
| `rapid_requests` | 5+ login attempts in 10 minutes | +20 |
| `vpn_proxy` | Known VPN or proxy IP | +15 |

## Recommendations

| Recommendation | Risk Score Range | Action |
|---------------|------------------|--------|
| `allow` | 0-20 | Normal login, proceed without additional verification |
| `monitor` | 21-50 | Suspicious but allowed, log for review, optionally re-prompt password |
| `challenge` | 51-100 | High risk, require additional verification (MFA, security questions) |

## Examples

### Example 1: Normal Login

**Request:**
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_456",
    "ipAddress": "203.0.113.42",
    "deviceFingerprint": "a3b5c7d9e1f2g4h6",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  }'
```

**Response:**
```json
{
  "riskScore": 0,
  "recommendation": "allow",
  "factors": [],
  "explanation": "Normal login pattern detected. No risk factors identified.",
  "requestId": "123e4567-e89b-12d3-a456-426614174000",
  "success": true
}
```

### Example 2: New Device

**Request:**
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_789",
    "ipAddress": "198.51.100.10",
    "deviceFingerprint": "brand_new_device_hash",
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)"
  }'
```

**Response:**
```json
{
  "riskScore": 20,
  "recommendation": "allow",
  "factors": ["new_device"],
  "explanation": "Risk factors: new device detected. User allowed.",
  "requestId": "234e5678-e89b-12d3-a456-426614174001",
  "success": true
}
```

### Example 3: Bot Detection

**Request:**
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_bot",
    "ipAddress": "192.0.2.50",
    "deviceFingerprint": "suspicious_device",
    "userAgent": "HeadlessChrome/91.0.4472.124"
  }'
```

**Response:**
```json
{
  "riskScore": 25,
  "recommendation": "monitor",
  "factors": ["bot_signals"],
  "explanation": "Risk factors: bot-like behavior detected. User allowed but flagged for monitoring.",
  "requestId": "345e6789-e89b-12d3-a456-426614174002",
  "success": true
}
```

### Example 4: High Risk (Multiple Factors)

**Request:**
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_suspicious",
    "ipAddress": "203.0.113.99",
    "deviceFingerprint": "unknown_device_hash",
    "userAgent": "python-requests/2.28.0"
  }'
```

**Response:**
```json
{
  "riskScore": 65,
  "recommendation": "challenge",
  "factors": ["new_device", "new_ip", "bot_signals"],
  "explanation": "Risk factors: new device detected, new IP address, bot-like behavior detected. Additional verification required.",
  "requestId": "456e7890-e89b-12d3-a456-426614174003",
  "success": true
}
```

### Example 5: Error Handling

**Request:**
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123"
  }'
```

**Response:**
```json
{
  "riskScore": 0,
  "recommendation": "allow",
  "factors": [],
  "explanation": "Missing required fields",
  "requestId": "567e8901-e89b-12d3-a456-426614174004",
  "success": false,
  "error": "userId, ipAddress, deviceFingerprint, and userAgent are required"
}
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success (even with errors in processing) |
| 400 | Bad request (missing required fields) |
| 405 | Method not allowed (non-POST request) |
| 500 | Internal server error |

**Note:** The API returns 200 even on processing errors, with `success: false` in the body. This ensures graceful degradation - failed risk assessments default to conservative monitoring rather than blocking users.

## Rate Limiting

Recommended rate limits for production:

- **Per IP:** 100 requests/minute
- **Per User ID:** 10 requests/minute
- **Global:** 10,000 requests/minute

Implement using:
- Upstash Redis
- Vercel Edge Config
- Cloudflare Workers

## Integration Guide

### Client-Side Integration

```typescript
import { verifyLogin } from '@/lib/client/verification-client';

async function handleLogin(userId: string) {
  // Verify the login attempt
  const result = await verifyLogin({ userId });
  
  // Handle based on recommendation
  switch (result.recommendation) {
    case 'allow':
      // Proceed with normal authentication
      break;
    
    case 'monitor':
      // Log but allow, maybe ask for password again
      console.warn('Suspicious login:', result.factors);
      break;
    
    case 'challenge':
      // Require MFA or additional verification
      showMFAPrompt();
      break;
  }
}
```

### Server-Side Integration

```typescript
import { calculateRiskScore, RiskInput } from '@/lib/scoring/risk-scorer';

async function checkLoginRisk(loginData: RiskInput) {
  const riskResult = calculateRiskScore(loginData);
  
  if (riskResult.recommendation === 'challenge') {
    return {
      allowed: false,
      requireMFA: true,
      message: riskResult.explanation
    };
  }
  
  return {
    allowed: true,
    monitor: riskResult.recommendation === 'monitor'
  };
}
```

## Webhook Notifications (Future)

For real-time alerts, configure webhooks to receive notifications when:
- Risk score exceeds threshold
- Repeated failed attempts detected
- Geographic anomaly detected

**Webhook Payload:**
```json
{
  "event": "high_risk_login",
  "userId": "user_123",
  "riskScore": 75,
  "factors": ["geo_impossible", "vpn_proxy"],
  "timestamp": "2024-08-25T14:30:00Z"
}
```

## Best Practices

1. **Always verify server-side** - Never trust client-provided risk scores
2. **Log all attempts** - Store in database for pattern analysis
3. **Monitor false positives** - Tune weights based on user feedback
4. **Combine with other signals** - Use with password strength, account age, etc.
5. **Respect privacy** - Only store necessary data, comply with GDPR/CCPA

## Performance

Target performance metrics:

- **Response time:** <100ms (p95)
- **Database query time:** <50ms
- **Uptime:** 99.9%
- **Error rate:** <0.1%

Monitor using:
- Vercel Analytics
- Sentry error tracking
- Custom logging to Supabase
