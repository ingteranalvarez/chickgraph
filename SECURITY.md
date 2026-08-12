# Security policy

Report vulnerabilities privately through GitHub Security Advisories for this
repository. Do not post credentials, personal data, or exploit details in a
public issue.

## Supported version

Only the current `main` branch is supported during the preview period.

## Operational notes

- Supabase service keys must remain server-only.
- All game commands are revalidated and computed on the server.
- Match state updates use optimistic version checks in Postgres.
- Row Level Security restricts match data to participants.
- Chat has automatic length and rate limits but no human moderation.
