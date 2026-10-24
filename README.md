# SignMentor — frontend (MSS301 VSL Platform)

React 19 + TypeScript + Vite. User flows are ported from the SBA `signmentor` app; the
visual design comes from `../design.html` (its stylesheet is copied verbatim into
`src/styles/design.css`, extensions live in `src/styles/app.css`).

## Run

```bash
npm install
cp .env.example .env      # VITE_GATEWAY_URL defaults to http://localhost:8080
npm run dev               # http://localhost:3000, /api is proxied to the api-gateway
npm run build             # type-check + production build into dist/
```

Docker: `docker build -t signmentor-fe .` serves `dist/` with nginx and proxies `/api/`
to `http://api-gateway:8080` (the service name in the backend's docker-compose).

## Flow

```
/  (landing) ─► /login ─┬─► USER  ─► /today  /learn  /lesson/:id  /dictionary  /request
               /register│            /studio  /community  /community/mine  /profile
      /forgot-password  └─► ADMIN ─► /admin  categories  signs  users  posts  reports  requests
```

- Register = details → email OTP → login. Forgot password = email → OTP → new password.
- Journey: each category is a chapter, split into lessons of 3 signs (watch → quiz → claim).
- Studio: camera → 3-2-1 → 5 s clip (centred square, un-mirrored) → `POST /practice/evaluate`
  → confidence / rank / message, then progress, stats and attempts are reloaded.
- "Due for review" = signs whose backend status is `LEARNING` (practised, never correct).

## Backend contract

All calls go through `src/api/endpoints.ts`, typed in `src/api/types.ts` against the
`ApiResponse` / `PageResponse` envelopes in `common-lib`. Tokens refresh automatically on 401.

| Service | Routes used | State |
|---|---|---|
| identity | `/auth/*`, `/users/*`, `/admin/users` | not implemented yet |
| learning | `/categories`, `/vocabularies`, `/practice/*`, `/attempts` | implemented |
| social | `/blogs/*`, `/user/blogs`, `/users/{id}/follow`, `/admin/blogs`, `/admin/reports` | not implemented yet |
| other | `/vocabulary-suggestions`, `/admin/analytics/*`, `/public/stats`, `/visits/track` | no gateway route yet |

Admin screens whose endpoint 404s show a "not available yet" notice instead of breaking.

## Stored on the device only

The backend has no concept of these, so they live in `localStorage` per user
(`src/lib/prefs.ts`): daily goal, favourites, finished guided lessons, today's
flashcard reviews, and reduced motion. Mentor is a rule-based coach over the user's
real progress (`src/components/MentorDrawer.tsx`) until a chat endpoint exists.
