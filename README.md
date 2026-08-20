# Aabriha Mart — Backend

Express + TypeScript API server for Aabriha Mart, backed by MongoDB (Mongoose). Verifies identity via Firebase Authentication ID tokens — it never stores passwords itself. All routes live under `/api/*`; there is no page host here, this is a pure JSON API.

See [`../docs/architecture.md`](../docs/architecture.md) for the full architectural record.

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Runs at `http://localhost:5000` by default (configurable via `PORT`), using `tsx watch` for hot reload. Requires `MONGODB_URI` to point at a reachable MongoDB instance (local or Atlas) and a Firebase Admin service account configured (see below) before it will start meaningfully.

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Never commit `.env` (already gitignored).

| Variable | Purpose |
| --- | --- |
| `PORT` | Port the server listens on (default `5000`) |
| `NODE_ENV` | `development` / `production` |
| `MONGODB_URI` | MongoDB connection string |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK — verifies ID tokens issued by the frontend |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK service account |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK service account (keep secret) |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode during development) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit account endpoint |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key — stays server-side only, never sent to the browser |

## Firebase authentication

The backend uses `firebase-admin` to verify ID tokens sent by the frontend as `Authorization: Bearer <token>`. Two middleware layers exist (`src/middleware/auth.ts`):

- `verifyFirebaseToken` — token-only check, used where a matching Mongo `User` document may not exist yet (first sign-in).
- `requireAuth` — verifies the token **and** resolves a Mongo `User` by `firebaseUid`, attaching `req.userId`/`req.userRole` for downstream handlers.

`requireRole(...roles)` gates admin-only routes on top of `requireAuth`. The backend never trusts a client-asserted user ID or role — every check is re-derived from the verified token and the database.

## Seed commands

There are two distinct seed scripts. **They are not interchangeable — read this before running either.**

```bash
npm run seed         # SAFE — additive only, never touches business data
npm run seed:reset   # DESTRUCTIVE — wipes and recreates the catalog
```

- **`npm run seed`** (`src/scripts/seed.ts`) calls `ensureStorefrontDefaults()`, which only inserts default `HeroBanner`/`Announcement`/`WelcomePopup` records if they don't already exist. It **never** deletes or modifies existing `Category`, `Product`, `Order`, `User`, or other business data. This is the only seed command safe to run against a database that has real data in it.
- **`npm run seed:reset`** (`src/scripts/seedReset.ts`) wipes and recreates `Category`, `Product`, and `DeliveryRate` from scratch (then also runs `ensureStorefrontDefaults()`). This is explicitly destructive, dev-only, and will **permanently delete existing catalog data** — do not run it against any database whose contents matter. It exists as a clearly separate, clearly named command specifically so it can never be triggered by accident in place of the safe seed.

## Build, typecheck, lint

```bash
npm run build    # tsc — type-checks and compiles to dist/
npm run start    # runs the compiled build (node dist/server.js)
```

There is no separate `typecheck` script — `npm run build` (the TypeScript compiler) is the type-check. There is no ESLint config or `lint` script in this repository at present.

## API / server URL

- API base: `http://localhost:5000` (default; configurable via `PORT`), all endpoints under `/api/*`.
- `GET /health` exists for basic liveness checking; a bare `GET /` is intentionally unmapped.

## Project structure

```text
src/
├── server.ts             Entry point — starts the HTTP server
├── app.ts                 Express app setup — middleware, route mounting
├── config/                 Env parsing, MongoDB connection, Firebase/Stripe/ImageKit clients
├── models/                  Mongoose schemas (User, Product, Category, Order, DeliveryRate,
│                             HeroBanner, Promotion, Announcement, WelcomePopup)
├── controllers/              Request handlers, one file per resource
├── routes/                    Express routers, one file per resource, mounted in app.ts
├── middleware/                 auth.ts (Firebase verification, role gating), errorHandler.ts
├── services/                    checkoutPricing.ts — stock decrement/restore, delivery pricing
└── scripts/                     seed.ts (safe), seedReset.ts (destructive), promoteAdmin.ts
```
