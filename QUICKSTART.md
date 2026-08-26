# Quick Start Guide

Get the Risk Scoring Authentication Engine running in under 5 minutes.

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Supabase

### Create Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to provision (~2 minutes)

### Run Migrations
1. In Supabase Dashboard, go to **SQL Editor**
2. Copy and run each migration file in order:
   - `supabase/migrations/001_create_login_attempts.sql`
   - `supabase/migrations/002_create_user_profiles.sql`
   - `supabase/migrations/003_helper_functions.sql`

### Get API Keys
1. Go to **Project Settings** > **API**
2. Copy your project URL and keys

## 3. Configure Environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 4. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Test It

1. Enter a user ID (e.g., `user_123`)
2. Click "Verify Login"
3. View the risk score and recommendation

## Try Different Scenarios

Test multiple times with the same user ID to see how the system learns patterns:

- **First login:** May show `new_device` factor (+20 risk)
- **Second login:** Should be normal (0 risk)
- **Different device:** Will trigger `new_device` again

## Optional: Add MaxMind GeoIP

For geographic features:

1. Register at [MaxMind](https://www.maxmind.com/en/geolite2/signup)
2. Get your license key
3. Run:
   ```powershell
   $env:MAXMIND_LICENSE_KEY="your-key"
   .\scripts\download-geoip.ps1
   ```

## Test the API Directly

```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "ipAddress": "192.168.1.1",
    "deviceFingerprint": "abc123hash",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  }'
```

## What's Next?

- **Customize weights:** Edit `.env.local` to adjust risk scoring
- **Integration:** Use `/api/verify` in your auth flow
- **Documentation:** See `docs/SETUP.md` and `docs/API.md`
- **Tests:** Run `npm test` to see unit tests

## Troubleshooting

**Database connection error?**
- Verify credentials in `.env.local`
- Check Supabase project is active

**Risk score always 0?**
- This is normal for first-time users
- Try logging in multiple times to build history

**API returns 500?**
- Check server logs in terminal
- Verify all migrations ran successfully

## Performance Targets

- ✓ Risk scoring: <100ms
- ✓ Database queries: <50ms
- ✓ Handles 1000+ logins without slowdown

---

**Ready to deploy?** See `docs/SETUP.md` for Vercel deployment instructions.
