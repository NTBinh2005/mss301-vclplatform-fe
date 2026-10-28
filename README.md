# SignMentor — frontend (MSS301 VSL Platform)

React 19 + TypeScript + Vite. User flows are ported from the SBA `signmentor` app (`vsl-frontend`);
the visual design comes from `../design.html` (its stylesheet is copied verbatim into
`src/styles/design.css`, extensions live in `src/styles/app.css`).

## Run

```bash
npm install
cp .env.example .env      # VITE_GATEWAY_URL defaults to http://localhost:8080
npm run dev               # http://localhost:3000, /api is proxied to the api-gateway
npm run build             # type-check + production build into dist/
npm run mock              # optional: fake gateway on :8090 (set VITE_GATEWAY_URL=http://localhost:8090)
```

Docker: start the backend stack first (`mss301-vslplatform-project`, `docker compose up -d`), then
`docker compose up -d --build` here. nginx serves `dist/` on port 3000 and proxies `/api/` to
`http://api-gateway:8080` over the backend's `mss301-vslplatform-project_vsl-net` network.

## Flow

```
/  (landing) ─► /login ─┬─► USER  ─► /today  /learn  /lesson/:id  /dictionary  /request
               /register│            /studio  /community  /community/mine  /profile  /people/:id
      /forgot-password  └─► ADMIN ─► /admin  categories  signs  users  posts  reports  requests
```

- UI in Vietnamese (`lang="vi"`, Be Vietnam Pro for full diacritics). Sign in with a username **or** email. Register = details → email OTP → login.
  Forgot password = email → OTP → new password.
- Journey: each category is a chapter, split into lessons of 3 signs (watch → quiz → claim).
- Studio: camera → 3-2-1 → 5 s clip → `POST /practice/evaluate` with the **vocabularyId**
  (several words can share one AI class) → confidence / rank / message.
  - MediaPipe PoseLandmarker frames a square around the signer (dashed guide on the preview)
    and the active part of the movement is sent as `startFrac`/`endFrac`.
  - In parallel, MediaPipe HandLandmarker compares finger shape and palm direction with the
    sign's tutorial video and adds hand-shape notes (`src/handAnalysis`).
  - The models and WASM are self-hosted in `public/models/mediapipe_hands` (CPU delegate).
    Without them the Studio still scores a centred crop.
- Community: feed, search (posts + people), likes, comments and replies with `@mention`,
  share (copy link / own page / a friend's page), follow, report, notifications.
  `/people/:id` shows someone's posts, shared posts, followers, following and friends.
  Share links from the backend (`APP_FRONTEND_URL/blogs/{id}`) open the post.
- "Due for review" = signs whose backend status is `LEARNING` (practised, never correct).

## Backend contract

All calls go through `src/services/*` (axios client in `src/api/client.ts`), typed in
`src/models` against the backend DTOs and the `ApiResponse` / `PageResponse` envelopes in
`common-lib`. Tokens refresh automatically on 401.

| Service | Routes used |
|---|---|
| identity | `/auth/*`, `/users/me[/password,/avatar (upload / URL / remove),/notifications]`, `/users/{id}`, `/users/search`, `/users/summaries`, `/users/admin/**` |
| learning | `/categories[/{id}/image]`, `/vocabularies[/{id}/image,/{id}/tutorial-video,/exists,/ai-synonyms]`, `/practice/*`, `/attempts`, `/vocabulary-suggestions[/admin]`, `/visits/track`, `/visits/admin/*`, `/public/stats` |
| social | `/blogs[/{id}/likes,/shares,/reports,/comments,/thumbnail]`, `/blogs/user/{id}[/shared]`, `/blogs/search`, `/comments/**`, `/follows/**`, `/notifications/**`, `/blogs/admin/**` |

Admin screens whose endpoint does not answer show a "not available yet" notice instead of breaking.

## Stored on the device only

The backend has no concept of these, so they live in `localStorage` per user
(`src/lib/prefs.ts`): daily goal, favourites, finished guided lessons, today's
flashcard reviews, and reduced motion. Mentor is a rule-based coach over the user's
real progress (`src/components/MentorDrawer.tsx`) until a chat endpoint exists.
