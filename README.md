# ChickGraph

ChickGraph is an open-source, browser-based mathematical artillery game. Players
take turns entering functions whose graphs become projectiles. Eliminate every
opposing chicken to win.

Play the public preview at [chickgraph.vercel.app](https://chickgraph.vercel.app).

The project is a clean-room implementation inspired by the mathematical
artillery genre. It does not contain Graphwar source code or assets.

## MVP features

- Google sign-in plus email/password registration and password recovery
- Immutable, case-insensitive unique usernames, country, and 16+ confirmation
- Public FIFO 1v1 matchmaking and private rooms with six-character invite codes
- Local unranked practice against a deterministic formula-playing bot
- Five-chapter, 18-challenge tutorial with live previews, progressive clues, and a real expression editor
- Server-authoritative normal-function mode with two chickens per player
- Deterministic seeded maps, circular hitboxes, 60-second turns, and reconnection
- Color-coded projectile, trajectory, and synchronized impact animations
- Supabase Realtime state updates, presence, and match chat
- Elo ratings and a worldwide leaderboard
- Responsive authentication and a desktop-first game interface

Match expressions support numbers, `x`, parentheses, `+`, `-`, `*`, `/`, `^`,
and `abs`, `sqrt`, `sin`, `cos`, `tan`, `exp`, `ln`, and `log`. The tutorial
covers every supported operator and function, including shots from both sides.

Google authentication is enabled in production. Six-digit email verification
templates are included under `supabase/templates`. Public email registration
still requires custom SMTP: Supabase's default mail provider refuses recipients
who are not members of the project's team and is not suitable for production.

## Stack

- Next.js 16 and React 19
- Supabase Auth, Postgres, Realtime, Row Level Security, and RPCs
- `mathjs` for parsing into an AST; evaluation uses a strict custom whitelist
- Vitest for deterministic engine tests
- Playwright for two-browser multiplayer and visual tests
- Vercel for the web deployment

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and add a Supabase project.

3. Link and migrate the database:

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   npx supabase config push
   ```

4. Start the application:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

The multiplayer E2E test creates two confirmed Supabase users, exercises the
guided tutorial, a practice match, a private room, and the public queue in separate browser
contexts, then deletes the test users. Public queue QA is opt-in with
`RUN_PUBLIC_QUEUE_E2E=true` and refuses to start unless the live queue is empty,
so automated users do not pair with real players. The test requires the
server-only Supabase secret in `.env.local`.

## Architecture

`src/lib/game` is a pure deterministic engine. Clients submit commands to Next.js
Route Handlers; only the server computes and commits the next versioned state.
Supabase stores durable match state and broadcasts updates. Clients animate the
committed shot rather than deciding outcomes locally.

Database migrations live in `supabase/migrations`. Match creation and pairing
are transactional Postgres functions. Row Level Security limits match data to
participants, while service credentials remain server-only.

## License

Source code is licensed under the GNU Affero General Public License v3.0 or
later. Original visual assets in `public/chickens` are licensed under Creative
Commons Attribution-ShareAlike 4.0. See [LICENSE](LICENSE) and
[ASSETS-LICENSE.md](ASSETS-LICENSE.md).
