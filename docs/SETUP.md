# Setup Guide

Complete setup instructions for the Risk Scoring Authentication Engine.

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- MaxMind account for GeoIP data (free)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the database to be provisioned

### 2.2 Run Migrations

In your Supabase dashboard:

1. Go to SQL Editor
2. Run each migration file in order:
   - `supabase/migrations/001_create_login_attempts.sql`
   - `supabase/migrations/002_create_user_profiles.sql`
   - `supabase/migrations/003_helper_functions.sql`

Alternatively, use Supabase CLI:

```bash
npx supabase db push
```

### 2.3 Get API Keys

1. Go to Project Settings > API
2. Copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

## Step 3: Configure Environment Variables

Create `.env.local` file in project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Risk Scoring Weights (optional - defaults provided)
RISK_WEIGHT_NEW_DEVICE=20
RISK_WEIGHT_NEW_IP=15
RISK_WEIGHT_GEO_IMPOSSIBLE=30
RISK_WEIGHT_TIME_ANOMALY=10
RISK_WEIGHT_BOT_SIGNALS=25
RISK_WEIGHT_RAPID_REQUESTS=20
RISK_WEIGHT_VPN_PROXY=15

# Risk Thresholds (optional - defaults provided)
RISK_THRESHOLD_MONITOR=21
RISK_THRESHOLD_CHALLENGE=51

# MaxMind GeoIP Database Path
MAXMIND_DB_PATH=./data/GeoLite2-City.mmdb
```

## Step 4: Set Up MaxMind GeoIP

### 4.1 Register for MaxMind

1. Go to [MaxMind GeoLite2 Signup](https://www.maxmind.com/en/geolite2/signup)
2. Create a free account
3. Generate a license key

### 4.2 Download Database

**On Windows (PowerShell):**
```powershell
$env:MAXMIND_LICENSE_KEY="your-license-key"
.\scripts\download-geoip.ps1
```

**On Linux/Mac:**
```bash
export MAXMIND_LICENSE_KEY="your-license-key"
./scripts/download-geoip.sh
```

This will download and extract `GeoLite2-City.mmdb` to the `data/` directory.

### 4.3 Verify Installation

Check that the file exists:
```bash
ls data/GeoLite2-City.mmdb
```

## Step 5: Optional - Set Up NeonDB

NeonDB provides connection pooling and can be used as a backup database.

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Add to `.env.local`:

```env
NEON_DATABASE_URL=postgres://user:password@hostname/database?sslmode=require
```

## Step 6: Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to test the system.

## Step 7: Test the API

### Using the Web Interface

1. Go to http://localhost:3000
2. Enter a user ID (e.g., `user_123`)
3. Click "Verify Login"
4. View the risk score and factors

### Using cURL

```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "ipAddress": "192.168.1.1",
    "deviceFingerprint": "abc123hash",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "timestamp": "2024-08-25T14:30:00Z"
  }'
```

### Expected Response

```json
{
  "riskScore": 20,
  "recommendation": "allow",
  "factors": ["new_device"],
  "explanation": "Risk factors: new device detected. User allowed.",
  "requestId": "req_xyz",
  "success": true
}
```

## Step 8: Run Tests

```bash
npm test
```

This will run the unit tests for the risk scoring logic.

## Deployment to Vercel

### 8.1 Connect to Vercel

```bash
npm install -g vercel
vercel login
vercel
```

### 8.2 Add Environment Variables

In Vercel dashboard:

1. Go to Project Settings > Environment Variables
2. Add all variables from `.env.local`
3. Redeploy

### 8.3 Upload MaxMind Database

Since Vercel is serverless, you have two options:

**Option 1: Bundle with deployment**
- Include the `.mmdb` file in your repository (add to git)
- Update `.gitignore` to allow it

**Option 2: Use external storage**
- Upload to S3 or similar
- Download at runtime (first cold start will be slower)

## Troubleshooting

### Database Connection Issues

- Verify Supabase credentials in `.env.local`
- Check Supabase project is not paused
- Ensure migrations ran successfully

### GeoIP Not Working

- Verify `GeoLite2-City.mmdb` exists in `data/` directory
- Check `MAXMIND_DB_PATH` in `.env.local`
- Update MaxMind license if expired (free version updates monthly)

### Risk Score Always 0

- This is normal for first-time users with no history
- Try the same user ID multiple times
- Change IP or device fingerprint to trigger factors

### API Returns 500 Error

- Check server logs with `npm run dev`
- Verify all environment variables are set
- Check database connection

## Performance Optimization

### Database Indexes

All necessary indexes are created by migrations. To verify:

```sql
SELECT * FROM pg_indexes WHERE tablename IN ('login_attempts', 'user_profiles');
```

### Caching

For production, consider:
- Redis for frequently accessed user profiles
- Edge caching for GeoIP lookups
- Database connection pooling with NeonDB

### Monitoring

Set up monitoring for:
- API response times (<100ms target)
- Database query performance (<50ms target)
- Error rates
- Risk score distribution

## Next Steps

1. **Integrate with your auth system** - Add risk scoring before password verification
2. **Customize weights** - Adjust scoring weights based on your security needs
3. **Add MFA** - Implement multi-factor authentication for high-risk logins
4. **Monitor patterns** - Track risk scores over time to tune thresholds
5. **Add alerting** - Get notified of suspicious activity patterns

## Support

For issues or questions:
- Check logs in Supabase dashboard
- Review error messages in browser console
- Verify all setup steps completed
