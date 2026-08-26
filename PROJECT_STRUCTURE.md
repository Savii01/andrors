# Project Structure

## Overview

```
andrors/
├── pages/                      # NextJS pages and API routes
│   ├── api/
│   │   └── verify.ts          # Main risk scoring API endpoint
│   ├── index.tsx              # Demo web interface
│   ├── _app.tsx               # NextJS app wrapper
│   └── _document.tsx          # HTML document template
│
├── lib/                       # Core libraries
│   ├── config/
│   │   └── scoring-config.ts  # Risk scoring weights and thresholds
│   ├── database/
│   │   ├── supabase-client.ts # Supabase client and types
│   │   └── queries.ts         # Database query functions
│   ├── scoring/
│   │   └── risk-scorer.ts     # Core risk calculation logic
│   ├── fingerprint/
│   │   └── device-fingerprint.ts # Client-side device fingerprinting
│   ├── geo/
│   │   └── ip-intelligence.ts # GeoIP and VPN detection
│   ├── client/
│   │   └── verification-client.ts # Client-side API wrapper
│   └── testing/
│       └── mock-data-generator.ts # Test data generation
│
├── supabase/                  # Database migrations
│   └── migrations/
│       ├── 001_create_login_attempts.sql
│       ├── 002_create_user_profiles.sql
│       └── 003_helper_functions.sql
│
├── __tests__/                 # Test files
│   └── scoring/
│       └── risk-scorer.test.ts
│
├── scripts/                   # Utility scripts
│   ├── download-geoip.ps1     # Windows GeoIP download
│   ├── download-geoip.sh      # Linux/Mac GeoIP download
│   └── test-risk-scorer.ts    # Manual testing script
│
├── docs/                      # Documentation
│   ├── SETUP.md               # Complete setup guide
│   └── API.md                 # API documentation
│
├── data/                      # Data files (gitignored)
│   └── .gitkeep               # Placeholder for MaxMind DB
│
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── next.config.js             # NextJS configuration
├── jest.config.js             # Jest test configuration
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── README.md                  # Project overview
├── QUICKSTART.md              # Quick start guide
└── PROJECT_STRUCTURE.md       # This file
```

## Key Components

### 1. API Layer (`pages/api/`)

**`verify.ts`** - Main API endpoint
- Accepts POST requests with login data
- Calculates risk score using core logic
- Stores results in database
- Returns recommendation (allow/monitor/challenge)
- Handles errors gracefully with fallback scoring

### 2. Core Logic (`lib/scoring/`)

**`risk-scorer.ts`** - Risk calculation engine
- Implements 7 risk factors:
  1. New Device (+20)
  2. New IP (+15)
  3. Geographic Impossibility (+30)
  4. Time Anomaly (+10)
  5. Bot Signals (+25)
  6. Rapid Requests (+20)
  7. VPN/Proxy (+15)
- Pure functions for testability
- Configurable weights via environment variables
- Returns score (0-100) and recommendation

### 3. Database Layer (`lib/database/`)

**`supabase-client.ts`** - Database connection
- Supabase client with service role
- TypeScript types for all tables
- Shared interfaces

**`queries.ts`** - Optimized queries
- Insert login attempts
- Get last N logins (indexed for speed)
- Check device existence
- Get/update user profiles
- All queries include error handling

### 4. Configuration (`lib/config/`)

**`scoring-config.ts`** - Centralized configuration
- Load weights from environment variables
- Default values for all settings
- Validation functions
- Type-safe configuration objects

### 5. Fingerprinting (`lib/fingerprint/`)

**`device-fingerprint.ts`** - Client-side fingerprinting
- Browser detection
- OS detection
- Screen resolution
- Canvas fingerprinting
- WebGL fingerprinting
- Deterministic hashing (same device = same hash)

### 6. Geo Intelligence (`lib/geo/`)

**`ip-intelligence.ts`** - Location and VPN detection
- MaxMind GeoIP2 Lite integration
- Distance calculation (Haversine formula)
- VPN/datacenter IP detection
- Geographic impossibility checks

### 7. Database Schema (`supabase/migrations/`)

**`login_attempts` table:**
- Stores all login attempts
- Indexed on user_id, timestamp, IP, device
- Includes risk score and factors
- JSONB for flexible geographic data

**`user_profiles` table:**
- Stores behavioral patterns
- Normal login hours
- Common locations
- Login count tracking

**Helper functions:**
- increment_login_count()
- get_recent_attempts_count()
- has_seen_device()
- get_normal_login_hours()
- cleanup_old_login_attempts()

### 8. Testing (`__tests__/` and `lib/testing/`)

**Unit tests:**
- Test each risk factor independently
- Test factor combinations
- Test edge cases (score capping at 100)
- Test recommendations at thresholds

**Mock data generator:**
- Generate realistic test scenarios
- Create normal vs suspicious patterns
- Batch login history generation

### 9. Client Integration (`lib/client/`)

**`verification-client.ts`** - Frontend helper
- Auto-generate device fingerprint
- Call /api/verify endpoint
- Handle responses
- Example integration patterns

## Data Flow

### Login Verification Flow

```
1. User attempts login
   ↓
2. Frontend generates device fingerprint
   ↓
3. POST /api/verify with login data
   ↓
4. API fetches user's previous logins
   ↓
5. Calculate risk score (0-100)
   ↓
6. Determine recommendation (allow/monitor/challenge)
   ↓
7. Store login attempt in database
   ↓
8. Return response to frontend
   ↓
9. Frontend takes action based on recommendation
```

### Risk Calculation Flow

```
1. Gather input data
   - User ID
   - IP address
   - Device fingerprint
   - User agent
   - Timestamp
   - Previous logins
   ↓
2. Check each risk factor
   - Is device new?
   - Is IP new?
   - Geographic impossibility?
   - Time anomaly?
   - Bot signals?
   - Rapid requests?
   - VPN/proxy?
   ↓
3. Sum weighted scores
   ↓
4. Cap at 100
   ↓
5. Determine recommendation based on thresholds
   ↓
6. Return result
```

## Environment Variables

All configurable through `.env.local`:

```env
# Database (Required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Risk Weights (Optional - defaults provided)
RISK_WEIGHT_NEW_DEVICE=20
RISK_WEIGHT_NEW_IP=15
RISK_WEIGHT_GEO_IMPOSSIBLE=30
RISK_WEIGHT_TIME_ANOMALY=10
RISK_WEIGHT_BOT_SIGNALS=25
RISK_WEIGHT_RAPID_REQUESTS=20
RISK_WEIGHT_VPN_PROXY=15

# Thresholds (Optional - defaults provided)
RISK_THRESHOLD_MONITOR=21
RISK_THRESHOLD_CHALLENGE=51

# GeoIP (Optional - features disabled if missing)
MAXMIND_DB_PATH=./data/GeoLite2-City.mmdb

# Backup DB (Optional)
NEON_DATABASE_URL=
```

## NPM Scripts

```json
{
  "dev": "next dev",              // Start dev server
  "build": "next build",          // Build for production
  "start": "next start",          // Start production server
  "lint": "next lint",            // Run ESLint
  "test": "jest",                 // Run unit tests
  "test:watch": "jest --watch"    // Run tests in watch mode
}
```

## Performance Optimizations

### Database Indexes

```sql
-- User-based queries
CREATE INDEX idx_login_attempts_user_id ON login_attempts(user_id);

-- Time-based queries
CREATE INDEX idx_login_attempts_timestamp ON login_attempts(timestamp DESC);

-- Combined user + time (most important)
CREATE INDEX idx_login_attempts_user_timestamp 
ON login_attempts(user_id, timestamp DESC);

-- IP-based lookups
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);

-- Device-based lookups
CREATE INDEX idx_login_attempts_device_fingerprint 
ON login_attempts(device_fingerprint);
```

### Query Optimization

- Limit results to last 10 logins
- Use indexed columns in WHERE clauses
- Sort by indexed timestamp column
- Combine related queries with Promise.all()

### Caching Strategy (Future)

- Cache user profiles in Redis
- Cache GeoIP lookups
- Cache VPN IP lists
- Connection pooling with NeonDB

## Security Considerations

1. **API Key Protection**
   - Service role key only on server
   - Never expose in client code
   - Use environment variables

2. **Rate Limiting** (TODO)
   - Per IP: 100 req/min
   - Per User: 10 req/min
   - Global: 10k req/min

3. **Data Privacy**
   - No passwords stored
   - Minimal PII collection
   - GDPR/CCPA compliant
   - 90-day data retention

4. **Input Validation**
   - Validate all API inputs
   - Sanitize user agents
   - Validate IP addresses
   - Check timestamp formats

## Deployment

### Vercel (Recommended)

```bash
vercel
```

**Requirements:**
- Add environment variables in Vercel dashboard
- Include MaxMind database in deployment
- Configure custom domain (optional)

### Performance Targets

- API response time: <100ms (p95)
- Database query time: <50ms
- Risk calculation: <10ms
- Uptime: 99.9%

## Next Steps

1. **Phase 1: MVP** ✓ Complete
   - Core scoring engine
   - Database schema
   - API endpoint
   - Basic tests

2. **Phase 2: Enhancement** (Future)
   - Rate limiting
   - Redis caching
   - Webhook notifications
   - Admin dashboard

3. **Phase 3: Advanced** (Future)
   - Machine learning integration
   - Real-time threat intelligence
   - Behavioral biometrics
   - Multi-tenant support

## Contributing

When adding new risk factors:

1. Add weight to `scoring-config.ts`
2. Add factor type to `risk-scorer.ts`
3. Implement detection logic
4. Add unit tests
5. Update documentation
6. Tune weight based on testing

## License

Private - Not for distribution
