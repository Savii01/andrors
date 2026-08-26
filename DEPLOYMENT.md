# Deployment Checklist

## Pre-Deployment

### 1. Environment Setup
- [ ] All environment variables configured in Vercel
- [ ] Supabase project is in production mode
- [ ] MaxMind GeoIP database included or accessible
- [ ] Database migrations applied to production database

### 2. Security Review
- [ ] No secrets committed to git
- [ ] API keys are server-side only
- [ ] CORS configured appropriately
- [ ] Rate limiting planned (if not implemented yet)
- [ ] Input validation tested

### 3. Testing
- [ ] All unit tests passing (`npm test`)
- [ ] Manual testing of API endpoint
- [ ] Test with multiple user scenarios
- [ ] Test error handling (database down, missing data)
- [ ] Load testing completed (optional but recommended)

### 4. Database
- [ ] Indexes created on all tables
- [ ] Helper functions deployed
- [ ] Backup strategy in place
- [ ] Connection pooling configured (NeonDB)
- [ ] Data retention policy configured (90 days)

### 5. Performance
- [ ] API response time <100ms verified
- [ ] Database queries optimized
- [ ] No N+1 query issues
- [ ] Caching strategy planned (if needed)

## Vercel Deployment

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login

```bash
vercel login
```

### Step 3: Deploy

```bash
vercel
```

Follow the prompts:
- Link to existing project or create new
- Select project settings
- Deploy

### Step 4: Configure Environment Variables

In Vercel Dashboard:

1. Go to **Project Settings** > **Environment Variables**
2. Add all variables from `.env.local`:

```env
# Production Variables
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key

# Risk Scoring Configuration
RISK_WEIGHT_NEW_DEVICE=20
RISK_WEIGHT_NEW_IP=15
RISK_WEIGHT_GEO_IMPOSSIBLE=30
RISK_WEIGHT_TIME_ANOMALY=10
RISK_WEIGHT_BOT_SIGNALS=25
RISK_WEIGHT_RAPID_REQUESTS=20
RISK_WEIGHT_VPN_PROXY=15

RISK_THRESHOLD_MONITOR=21
RISK_THRESHOLD_CHALLENGE=51

# GeoIP Database Path
MAXMIND_DB_PATH=./data/GeoLite2-City.mmdb
```

3. Set environment for each variable:
   - **Production**: Required
   - **Preview**: Optional (can use same as prod for testing)
   - **Development**: Not needed (uses local .env.local)

### Step 5: Handle MaxMind Database

**Option A: Include in Git (Simple)**

1. Remove `*.mmdb` from `.gitignore`
2. Commit the database file
3. Push to repository
4. Redeploy

**Option B: External Storage (Recommended for Production)**

1. Upload `.mmdb` file to S3, R2, or similar
2. Add download logic in API initialization:

```typescript
// In lib/geo/ip-intelligence.ts
async function downloadGeoIPDatabase() {
  const url = process.env.GEOIP_DATABASE_URL;
  // Download and cache
}
```

3. Set `GEOIP_DATABASE_URL` in environment variables

**Option C: Bundle at Build Time**

1. Add to `vercel.json`:

```json
{
  "functions": {
    "api/**/*.ts": {
      "includeFiles": "data/GeoLite2-City.mmdb"
    }
  }
}
```

### Step 6: Deploy Production

```bash
vercel --prod
```

### Step 7: Verify Deployment

```bash
curl -X POST https://your-domain.vercel.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "ipAddress": "8.8.8.8",
    "deviceFingerprint": "test_device",
    "userAgent": "Mozilla/5.0"
  }'
```

## Post-Deployment

### 1. Monitoring Setup

**Vercel Analytics**
- Enable in project settings
- Monitor response times
- Track error rates

**Sentry Integration** (Optional)
```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

**Supabase Logs**
- Go to Logs section
- Set up alerts for errors
- Monitor query performance

### 2. Custom Domain (Optional)

1. Go to Vercel Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Wait for SSL certificate provisioning

### 3. Rate Limiting

**Using Upstash Redis:**

```bash
npm install @upstash/ratelimit @upstash/redis
```

Add to API route:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
});

// In API handler
const { success } = await ratelimit.limit(ipAddress);
if (!success) {
  return res.status(429).json({ error: "Too many requests" });
}
```

### 4. CORS Configuration

Add to `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://yourdomain.com" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};
```

### 5. Database Backup

**Supabase Automatic Backups:**
- Free tier: Daily backups (7-day retention)
- Pro tier: Point-in-time recovery

**Manual Backup:**
```bash
pg_dump $DATABASE_URL > backup.sql
```

**Scheduled Backups:**
- Set up GitHub Action or Vercel Cron
- Store in S3 or similar

### 6. Cost Monitoring

**Vercel Free Tier Limits:**
- 100 GB bandwidth/month
- 100 GB-hours compute/month
- Unlimited API requests

**Supabase Free Tier Limits:**
- 500 MB database
- 1 GB file storage
- 2 GB bandwidth/month

**Monitor usage in dashboards**

## Scaling Considerations

### When to Scale

**Database:**
- Query time >100ms consistently
- Connection pool exhaustion
- Storage >400MB (80% of free tier)

**API:**
- Response time >200ms
- High error rates
- CPU usage >80%

### Scaling Options

**Database Scaling:**
1. Upgrade Supabase to Pro ($25/month)
2. Add NeonDB for connection pooling
3. Implement Redis caching
4. Optimize queries and indexes

**API Scaling:**
1. Enable Vercel Edge Functions
2. Add CDN caching
3. Implement request queueing
4. Split into microservices

**Cost Optimization:**
- Cache GeoIP lookups
- Batch database writes
- Implement data retention policy
- Use serverless for variable load

## Rollback Procedure

If issues arise after deployment:

### 1. Quick Rollback
```bash
vercel rollback
```

### 2. Revert to Specific Deployment
1. Go to Vercel Dashboard > Deployments
2. Find working deployment
3. Click "Promote to Production"

### 3. Database Rollback
```bash
psql $DATABASE_URL < backup.sql
```

## Health Checks

Create `/api/health` endpoint:

```typescript
export default function handler(req, res) {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: "connected", // Check actual connection
    geoip: "loaded", // Check MaxMind loaded
  });
}
```

Monitor with:
- Uptime Robot (free)
- Pingdom
- StatusCake

## Maintenance

### Weekly
- [ ] Check error logs
- [ ] Review response times
- [ ] Monitor database size
- [ ] Check for failed requests

### Monthly
- [ ] Update MaxMind GeoIP database
- [ ] Review and tune risk weights
- [ ] Analyze false positive rate
- [ ] Clean old data (>90 days)

### Quarterly
- [ ] Update dependencies
- [ ] Security audit
- [ ] Performance review
- [ ] Cost analysis

## Troubleshooting

### API Returns 500
1. Check Vercel logs
2. Verify environment variables
3. Test database connection
4. Check MaxMind database loaded

### Database Connection Issues
1. Verify Supabase credentials
2. Check connection pooling
3. Monitor active connections
4. Check for query timeouts

### High Response Times
1. Enable Vercel Analytics
2. Profile slow queries
3. Check database indexes
4. Consider caching

### MaxMind Not Working
1. Verify file path in environment
2. Check file exists in deployment
3. Verify file format (must be .mmdb)
4. Check MaxMind license is active

## Support Contacts

- **Vercel Support:** vercel.com/support
- **Supabase Support:** supabase.com/support
- **MaxMind Support:** support.maxmind.com

## Success Criteria

Deployment is successful when:
- ✅ API responds <100ms (p95)
- ✅ Database queries <50ms
- ✅ No errors in production logs
- ✅ All risk factors working correctly
- ✅ Data is being stored properly
- ✅ Uptime >99.9%

## Next Steps After Deployment

1. **Monitor** for 24 hours
2. **Tune** risk weights based on real data
3. **Add** rate limiting if traffic is high
4. **Implement** alerting for anomalies
5. **Document** any production-specific configurations
6. **Plan** for scale based on usage patterns

---

**Deployment Date:** _________________  
**Deployed By:** _________________  
**Production URL:** _________________  
**Verification Status:** [ ] Passed
