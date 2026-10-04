# Cliniolab Failover Service

This is an independent Cloudflare Worker used as a routing and failover layer.

## Architecture

Production traffic:

Cloudflare Failover Worker
→ Primary Cliniolab Worker
→ Vercel backup

The application itself does not need to contain Vercel-specific failover logic.

## Configuration

Set:

- PRIMARY_ORIGIN
- BACKUP_ORIGIN
- HEALTH_PATH

Do not put database credentials, payment secrets, Supabase service-role keys, or other sensitive secrets in this configuration.

## Safe failover

Only GET, HEAD, and OPTIONS requests are eligible for automatic failover.

POST, PUT, PATCH, and DELETE requests are never automatically replayed against the backup.

This prevents potentially dangerous duplicate operations involving:

- Payments
- Purchases
- Account changes
- Admin actions
- Other state-changing requests

## Deployment

From this directory:

```bash
npx wrangler deploy
