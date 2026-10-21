# AI Asisten Yosep — Cloudflare deployment

This is a Cloudflare Workers adaptation of the existing FastAPI portal. It uses Workers AI, D1, and static assets. It does not require a traditional VPS and can run on Cloudflare's free tier within its current quotas.

## Required one-time account setup
1. Create a Cloudflare account and open Workers & Pages.
2. Create a D1 database named `ai-asisten-yosep`.
3. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc` with the D1 database ID.
4. From Cloudflare's online editor or a trusted local CLI, run the migration in `migrations/0001_init.sql`.
5. Add a secret named `SESSION_SECRET` (at least 32 random characters). Set `OWNER_EMAIL` in Worker variables to the owner's email before registering the admin account.
6. Deploy this Worker with static assets and the Workers AI binding enabled.

The repository alone cannot create or authorize resources in a user's Cloudflare account. Do not put secrets in GitHub or send them in chat.

## Notes
- Uses Cloudflare Workers AI model `@cf/meta/llama-3.1-8b-instruct`; model availability and free quota are subject to Cloudflare's current terms.
- Free plan quotas and outages mean uninterrupted 24/7 operation cannot be guaranteed.
- Review the authentication, security, data retention, and model settings before inviting other users.
