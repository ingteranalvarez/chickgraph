# Operations

## Weekly check (target: under one hour)

1. Check Vercel deployment status and function errors.
2. Check Supabase database size, Auth email quota, Realtime connections, and API errors.
3. Confirm public queue and private room E2E still pass.
4. Review dependency alerts and failed GitHub Actions.

## Deployment

Vercel requires these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_EMAIL_VERIFICATION_MODE`
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`

After assigning the production URL, add its `/auth/callback` URL to Supabase Auth
redirect URLs and set the Supabase site URL to the production origin.

Run the E2E suite against production without starting a local server:

```bash
PLAYWRIGHT_BASE_URL=https://chickgraph.vercel.app npm run test:e2e
```

## Email and Google authentication

Supabase's default email provider only delivers to members of the project's team.
Public registration therefore requires custom SMTP; the deployed form is not
operational for arbitrary addresses until that provider is configured.

After configuring custom SMTP, push the six-digit confirmation template from
`supabase/config.toml`, set `NEXT_PUBLIC_EMAIL_VERIFICATION_MODE=code`, and verify
registration plus password recovery with an address outside the Supabase team.
Keep SMTP credentials in Supabase only and never commit them to this repository.

Google login requires a Google OAuth client and the Supabase callback URL. Set
`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` only after the provider is enabled.

## Incident response

For abuse or a compromised account, disable the affected user in Supabase Auth.
For systemic abuse, disable signups or the application deployment. No moderator
console or manual chat moderation exists in the MVP.
