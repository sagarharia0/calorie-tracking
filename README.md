# Macro

A personal calorie & macro tracker built as a Progressive Web App. Targets Android via "Add to Home Screen" — no Capacitor, no React Native, just a fast installable web app.

> **Status:** v1 functional. Daily logging, smart-swap suggestions, AI-generated insights, barcode scanning, and PWA installation are all live. UI polish pass deferred — see [What's next](#whats-next).

---

## What it does

- **Log meals** by typing items, picking from a personal foods library (recents + prefix search), or scanning a UK product barcode.
- **Track macros** (carbs, protein, fat) and total kcal against a goal you can change over time. Goals are time-series — historical "vs. goal" charts use the goal that was active *then*.
- **Smart Swap** — flagged items (high cal / high fat / high carb-share) get a `✨ Swap` button. Tap it for 3–5 LLM-generated alternatives with macro deltas and a reason.
- **Good Foods** — a curated library of items you've marked good. Filter by hunger band (Snack / Light / Main) based on remaining kcal today. Hit "Suggest 5 for me" for AI proposals.
- **Insights** — day-level pass/fail metrics ("X/7 days within kcal limit", "X/7 hit macro target") instead of weekly averages. Includes by-label averages, streak, alcohol units (NHS 14-units guidance), and AI-generated "What's working" + "Biggest swap opportunity" cards.
- **Alcohol tracking** — UK units, conditional surfacing only when you've actually logged any.
- **Offline-capable** — Firestore persistent cache + service worker shell. The app loads even on a flaky connection; LLM calls require network.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React 19 + TypeScript | Fast iteration, modern React, type safety on a personal-scale app |
| Auth | Firebase Auth + Google SSO | Single sign-in, no password mgmt |
| Database | Firestore (`europe-west2`) | Realtime listeners + offline cache, scales from one user to many |
| Backend | Firebase Cloud Functions v2 | Auth-verified callable endpoints, Anthropic API key kept server-only |
| AI | Anthropic Claude Opus 4.7 via tool-use | Structured output, low hallucination on small inputs |
| Food data | Open Food Facts (live, barcode lookup) | Public API, no key needed |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest + service worker + offline shell |
| Hosting | Firebase Hosting | Same project as Functions, single deploy story |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React PWA (browser / installed app on Android)              │
│   ─ Auth context (Google SSO)                                │
│   ─ Firestore onSnapshot listeners (live data)               │
│   ─ httpsCallable wrappers in src/lib/cloud.ts               │
│   ─ Service worker (app shell + offline cache)               │
└────────────────────────┬─────────────────────────────────────┘
                         │
   ┌─────────────────────┼─────────────────────────┐
   │                     │                         │
   ▼                     ▼                         ▼
┌──────────────┐   ┌──────────────┐         ┌──────────────────┐
│  Firestore   │   │ Cloud        │         │ Open Food Facts  │
│              │   │ Functions    │         │ /api/v2/product  │
│ /users/{uid} │   │  · requestSwaps         │ (browser → OFF)  │
│   /goals     │   │  · suggestFoods│        └──────────────────┘
│   /labels    │   │  · insightSummary
│   /days/...  │   └───────┬──────┘
│   /foods     │           │
└──────────────┘           ▼
                  ┌────────────────┐
                  │ Anthropic API  │
                  │ (Claude Opus)  │
                  └────────────────┘
```

**Data model** is single-user-now / multi-user-ready: everything scoped under `/users/{uid}/...`. Day docs keyed by `YYYY-MM-DD` for direct lookup. Items embedded inside meal docs (one read instead of N+1). Cached `totals` on each day doc are atomically updated via `writeBatch + increment` on every meal write/delete — see [src/lib/repo/meals.ts](src/lib/repo/meals.ts).

**AI calls** never expose the Anthropic API key to the client. The pattern: client → Cloud Function (verifies Firebase Auth ID token) → Anthropic API → structured tool-use response → client. Each function is in its own file under [functions/src/](functions/src/).

**Insights cache** is content-hash-keyed in `localStorage` — same input data → same output, no LLM call. Invalidates automatically when a new meal is logged or the goal changes.

---

## Local development

### Prerequisites

- Node 20+ (project uses 22)
- A Firebase project (Blaze plan — required for Cloud Functions)
- An Anthropic API key (for LLM features)

### Setup

```bash
git clone https://github.com/sagarharia0/calorie-tracking.git
cd calorie-tracking
npm install

# Copy and fill in your Firebase web config
cp .env.example .env.local
# (Firebase Console → Project settings → Web app → Config object)
```

Apply the security rules from [firestore.rules](firestore.rules) in your Firebase Console (Firestore → Rules → paste → publish).

### Run

```bash
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
npm run preview      # preview the production build (test PWA install)
```

### Deploy

```bash
# One-time setup
npm install -g firebase-tools
firebase login
firebase use --add  # select your project

# Functions: install deps + set the Anthropic key as a secret
cd functions && npm install && cd ..
firebase functions:secrets:set ANTHROPIC_API_KEY  # paste sk-ant-... when prompted

# Deploy functions, then grant Cloud Run public invocation
firebase deploy --only functions
gcloud run services add-iam-policy-binding requestswaps \
  --region=europe-west2 --member=allUsers --role=roles/run.invoker
gcloud run services add-iam-policy-binding suggestfoods \
  --region=europe-west2 --member=allUsers --role=roles/run.invoker
gcloud run services add-iam-policy-binding insightsummary \
  --region=europe-west2 --member=allUsers --role=roles/run.invoker

# Deploy hosting (auto-builds first via predeploy hook)
firebase deploy --only hosting
```

The Cloud Run IAM grants are needed because Firebase v2 callable functions don't always auto-grant public invocation; the function code itself still verifies auth via the Firebase ID token in the request body.

### Costs at personal scale

Anthropic Opus 4.7: ~$0.04–$0.06 per LLM call. Insights cached aggressively, swaps fire on tap, food suggestions on demand → typically <£3/month.

Firebase Blaze free tier easily covers personal use (2M function invocations/mo, 50k Firestore reads/day).

---

## Project layout

```
src/
  components/           Atomic UI primitives (Icon, MacroBar, etc.) + forms
  contexts/             React contexts (auth)
  data/                 Static mock data (legacy from design port)
  hooks/                useDay, useActiveGoal, useLast7Days
  lib/
    repo/               Typed Firestore wrappers per collection
    firebase.ts         SDK init (Firestore + Auth + Functions)
    cloud.ts            Typed httpsCallable wrappers
    flags.ts            Item-flag thresholds, size/hunger bands
    macros.ts           Atwater conversions, recompute helpers
    insightsCalc.ts     Pure helpers for the Insights screen
    openfoodfacts.ts    OFF v2 lookup
  screens/              One file per route (Home, Day, Goals, Labels, Insights, Scanner, Swaps, GoodFoods, AddMeal)
  styles/macro.css      OKLCH design tokens + atomic class system
  types/firestore.ts    Source-of-truth types

functions/
  src/
    swap.ts             requestSwaps callable (smart-swap LLM)
    suggestFoods.ts     suggestFoods callable (good-foods AI)
    insightSummary.ts   insightSummary callable (week narrative)
    index.ts            Re-exports

firestore.rules         User-scoped read/write rules
firebase.json           Hosting + Functions config
public/
  logo.svg              App icon (manifest + favicon + apple-touch)
  manifest.webmanifest  PWA manifest
```

---

## What's next

- **Final UI polish pass** — the screens are functionally correct and visually close to the design exports, but spacing, typography, and micro-interactions want a sweep before "v1 done."
- **Bundle splitting** — current main bundle is ~770 KB gzipped; splitting Firebase SDK and React Router would reduce first-paint cost.
- **CoFID bundling** — UK government's Composition of Foods dataset (~3,300 generic ingredients) bundled as static JSON would give the LLM stronger ingredient knowledge for swap suggestions.
- **Free-text meal logging** — "two eggs and toast" → parsed into items via LLM. Punted to v1.1.

---

## Built with Claude Code

This project was built collaboratively with [Claude Code](https://claude.com/claude-code). The commit history captures the back-and-forth — design decisions, trade-offs, and iterative validation gates between phases. Memory files (architecture, data model, design rationale) live outside the repo to keep this README focused on what readers actually need.

---

## License

[MIT](LICENSE)
