# The GA4 Setuper

> Guessed vs. confirmed: everything below was read directly out of the code in this repo (`backend/` and `extension/`) — package.json, the Prisma schema, the `.env.example` file, every API route, and every page. Anywhere I inferred something instead of reading it verbatim (mainly: which Node version to use, since nothing in the repo pins one), I've flagged it inline with **(inferred)**.

---

## 1. What this project is

This project turns "click through your site once" into a ready-to-review Google Tag Manager + GA4 setup. You install a Chrome extension, record yourself walking through a funnel (e.g. Product page → Add to cart → Checkout → Purchase), and it captures each step as a clean spec. That spec gets sent to a small web dashboard where you review the funnel as a diagram, approve it, and then push the matching GTM triggers and tags into a **draft workspace** — nothing is ever auto-published, you always review and publish from GTM yourself.

Today, only the **client-side GTM + GA4 path** is actually built and working. The dashboard's flow diagram also shows a "Stape" pill next to GTM and GA4 on every step — that's a placeholder for a planned **server-side setup (GTM + GA4 + Stape.io)**, but there's no code behind it yet. It will always say "pending" no matter what you do. Don't go looking for a Stape smoke test below — there isn't one yet, because there's nothing to test.

## 2. Project structure

```
The-GA4-Setuper/
├── backend/                        Next.js web app — the dashboard you sign into
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/ Google sign-in (NextAuth)
│   │   │   ├── funnels/            Create/list funnels, approve, GTM plan preview, GTM push
│   │   │   └── gtm/                Connect GTM, OAuth callback, list accounts/containers, save selection
│   │   ├── dashboard/               List of your captured funnels
│   │   ├── funnels/[id]/            Funnel detail (flow diagram), GTM setup wizard, API call log
│   │   ├── signin/                  "Sign in with Google" screen
│   │   ├── settings/                Connect Google Tag Manager
│   │   └── globals.css              Color variables and shared styles
│   ├── components/                  Shared React pieces (flow diagram, approve button, status badges)
│   ├── lib/
│   │   ├── gtm/                     All Google Tag Manager logic: OAuth, raw API calls, planning (create vs. reuse vs. conflict), building trigger/tag JSON
│   │   ├── auth.ts                  NextAuth configuration
│   │   ├── prisma.ts                Database client
│   │   └── schema.ts                Validation rules for an incoming funnel JSON (what the extension sends)
│   ├── prisma/
│   │   ├── schema.prisma            Database table definitions (Funnel, FunnelStep, User, GtmConnection, GtmApiLog…)
│   │   ├── migrations/              Ordered SQL steps that build the database from nothing
│   │   └── seed.ts                  Creates one demo user with a fixed, known API key
│   ├── .env.example                 Template for the secrets you'll need (copy this)
│   └── package.json                 Dependency list + npm scripts (dev/build/seed)
└── extension/                       Chrome extension — records a funnel by clicking through your site
    ├── manifest.json                 Extension configuration (Chrome reads this on load)
    ├── background.js                 Keeps recording state while you browse between pages
    ├── content/content.js            Watches clicks, page changes, and form submits on the page itself
    ├── lib/selector.js                Picks a stable CSS selector for whatever you clicked
    ├── lib/url-pattern.js             Turns a URL into a reusable pattern (e.g. numeric IDs become *)
    └── sidepanel/                     The panel UI you open from the Chrome toolbar (record, review, export, send)
```

Everything you'll run lives inside `backend/` — that's the only folder with a `package.json`. The `extension/` folder isn't installed with npm at all; Chrome loads it directly as a folder of plain files (see Section 5).

## 3. Prerequisites

| Tool | Version needed | Check what you have | Install if missing |
|---|---|---|---|
| **Node.js** | 20.x LTS (Next.js 14 requires ≥18.18, but 20 is the safest bet and what I'd install fresh) **(inferred — not pinned in this repo)** | `node -v` | https://nodejs.org (choose the "LTS" download) |
| **npm** | Comes bundled with Node — no separate install | `npm -v` | — |
| **Google Chrome** | Any recent version, to load the extension | — | https://www.google.com/chrome/ |

You do **not** need to install a database server. The project uses SQLite, which is just a file (`dev.db`) that gets created for you — no separate service to run.

If `node -v` prints something below `v18.18`, install Node 20 from the link above before continuing (on macOS/Linux, a version manager like `nvm` makes switching versions painless; on Windows, the installer from nodejs.org is enough).

## 4. First-time setup

Run these from the `backend/` folder — open a terminal and `cd backend` first.

### Step 1 — Install dependencies

```
npm install
```
Downloads every library the project depends on (Next.js, React, Prisma, the Google API client, etc.) into a local `node_modules` folder. Takes about 1–2 minutes on a normal connection. You'll see this again anytime `package.json` changes.

### Step 2 — Set up your environment variables

Copy the template file and then fill it in:
```
cp .env.example .env.local
```
This creates `.env.local` — a file Next.js reads automatically and which is already excluded from git (see `.gitignore`), so your secrets never get committed. Open it and fill in each value:

| Variable | What it's for | Where to get it | If it's missing or wrong |
|---|---|---|---|
| `DATABASE_URL` | Where your local SQLite database file lives | Already filled in for you (`file:./dev.db`) — leave it alone unless you want a different filename | The app can't read or write any data; you'll get database connection errors on every page |
| `NEXTAUTH_SECRET` | A random key NextAuth uses to encrypt your sign-in session cookie | Generate one yourself: run `openssl rand -base64 32` in your terminal and paste the output in | Sign-in will fail or NextAuth will print a `NO_SECRET` warning/error to the terminal |
| `NEXTAUTH_URL` | The base web address of your own running app | Already filled in for local use (`http://localhost:3000`) — only change it if you run the app on a different port | Google sign-in redirects will land on the wrong address and fail |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Lets you sign in with Google, **and** lets the app request permission to read/edit your Google Tag Manager container | Google Cloud Console → **APIs & Services → Credentials** → create an **OAuth client ID** (type: Web application). Add both `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/gtm/callback` as Authorized redirect URIs on that same client. Then go to **APIs & Services → Library** and enable the **Tag Manager API** — the OAuth client alone isn't enough, the API itself has to be turned on for the project | Sign-in will fail immediately (you won't even reach the app), or if you get further, connecting GTM in Settings will fail |

These are the **only** credentials the project needs today — there's no separate Stape.io API key or domain setting to fill in, because that path isn't built yet.

### Step 3 — Set up the database

```
npx prisma migrate dev
```
This reads every file in `prisma/migrations/` and replays them in order to build a brand-new `dev.db` SQLite file with all the right tables, then generates the Prisma "client" code the app uses to talk to that database. Takes 5–10 seconds. Re-run it any time you pull changes that add a new migration.

Optional but useful — seed a demo user with a fixed, known API key (handy for testing without going through Google sign-in at all):
```
npm run seed
```
This creates one row in the `User` table with email `demo@funnel-setuper.local` and API key `demo-api-key-local-dev-only`. You'll use that exact key in the smoke test in Section 6.

## 5. Running it locally

```
npm run dev
```
Starts the Next.js development server. Takes a few seconds to boot. Leave this terminal window running — closing it stops the app.

Open **http://localhost:3000** in your browser.

- If you're not signed in, you'll be redirected straight to a sign-in screen: a dark card centered on the page with the text "FUNNEL SETUPER" and a single "Sign in with Google" button.
- After signing in with the Google account you set up in Step 2, you'll land on **/dashboard** — a page titled "Your funnels" with a short explanation line underneath, and either a dashed empty-state box saying *"No funnels yet. Record one with the Chrome extension and it'll show up here."*, or a list of funnel cards if you've already sent one in.

If instead you see a raw error page or the terminal shows a crash, jump to Section 7 — most first-run problems are one of the errors listed there.

## 6. How to test that it's actually working

**One honest note first:** the Chrome extension's "Send" button currently does not attach your API key to the request, so clicking it will fail with a 401 error no matter what you type into the "backend URL" box. Until that's fixed in the code, use the extension to *record and export* a funnel (its "Copy JSON" button works fine), then send that JSON yourself with `curl` as shown below. This is the one thing in this README that's a workaround for a real gap in the current code, not a limitation of the instructions.

### Test A — the ingestion API works (no Google account needed, ~2 minutes)

This only proves the backend can receive and store a funnel — it won't show up anywhere in the browser, because it belongs to the seeded demo user, not to whatever Google account you sign in with.

1. Make sure you ran `npm run seed` (Section 4, Step 3).
2. With `npm run dev` still running, in a second terminal run:
   ```
   curl -i -X POST http://localhost:3000/api/funnels \
     -H "Authorization: Bearer demo-api-key-local-dev-only" \
     -H "Content-Type: application/json" \
     -d '{
       "funnelName": "Test funnel",
       "steps": [
         { "order": 1, "label": "Landing page", "urlPattern": "/", "trigger": { "type": "pageview", "selector": null } },
         { "order": 2, "label": "Clicked Buy Now", "urlPattern": "/product", "trigger": { "type": "click", "selector": "#buy-now" } }
       ]
     }'
   ```
3. **You've succeeded** if you see `HTTP/1.1 201 Created` and a body like `{"id":"cl...","status":"draft"}`. Any 401/400 means an env var or a typo in the JSON — see Section 7.

### Test B — the full reviewable path, GTM + GA4 (needs your real Google credentials from Section 4)

1. Sign in with Google at http://localhost:3000 — this creates *your* user row in the database, with its own real API key (different from the demo one).
2. Find your personal API key: run `npx prisma studio` (opens a database browser at http://localhost:5555), open the **User** table, and copy the `apiKey` value from your row.
3. Submit a funnel as *you*, same as Test A but with your real key instead of the demo one:
   ```
   curl -i -X POST http://localhost:3000/api/funnels \
     -H "Authorization: Bearer <your apiKey from Prisma Studio>" \
     -H "Content-Type: application/json" \
     -d '{"funnelName":"Checkout funnel","steps":[{"order":1,"label":"Product page","urlPattern":"/product/*","trigger":{"type":"pageview","selector":null}},{"order":2,"label":"Add to cart","urlPattern":"/product/*","trigger":{"type":"click","selector":".add-to-cart"}}]}'
   ```
4. Refresh **/dashboard** — you should now see a card named "Checkout funnel", "2 steps", and a dashed "draft" badge.
5. Click into it. You should see a horizontal flow diagram: two dashed step cards connected by a dashed arrow, each showing pills for GTM, GA4, and Stape, all reading "pending".
6. Click **Approve** (bottom right). The badge changes to solid "approved" and the connectors between steps turn solid.
7. Before setting up GTM you need a connection: go to **Settings**, click **Connect Google Tag Manager**, approve the Google consent screen, then pick your GTM account and container from the two dropdowns and click **Use this container**.
8. Back on the funnel page, click **Set up in Google Tag Manager →**. You should see a preview page: a "GA4 Configuration" box (asking for a `G-XXXXXXX` measurement ID if none exists yet in your container) and one box per funnel step showing whether its trigger/tag will be **new**, **reused**, or in **conflict**, plus an editable GA4 event name for each.
9. Click **Push to GTM (draft only)**. You should see a result screen listing "created"/"reused" for each step and a green confirmation: *"Draft written to your workspace. Nothing has been published."* — with a link that opens the actual GTM workspace in a new tab so you can confirm the trigger and tag really exist there.

If step 9 succeeds and you can see the new trigger/tag sitting in an unpublished GTM workspace, the whole client-side path is confirmed working end to end.

## 7. Common errors and fixes

- **`Error: listen EADDRINUSE: address already in use :::3000`** — something else is already using port 3000 (often a previous `npm run dev` you forgot to stop). Either stop that process, or run `npm run dev -- -p 3001` and update `NEXTAUTH_URL` in `.env.local` to `http://localhost:3001` (and update your Google OAuth redirect URIs to match).
- **You are using Node.js x.x.x. ... Node.js version >= "18.18.0"` is required** — your Node install is too old. Install Node 20 (Section 3) and try again.
- **NextAuth prints `[next-auth][error][NO_SECRET]` or sign-in silently does nothing** — `NEXTAUTH_SECRET` is missing or empty in `.env.local`. Generate one with `openssl rand -base64 32`.
- **`The table 'main.User' does not exist in the current database`** (or similar Prisma table-not-found errors) — you skipped `npx prisma migrate dev`. Run it, then restart `npm run dev`.
- **Google shows `Error 400: redirect_uri_mismatch` when you click Sign in with Google** — the redirect URIs on your OAuth client in Google Cloud Console don't exactly match what the app is requesting. Double-check both `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/gtm/callback` are listed, character for character (no trailing slash).
- **`{"error":"Missing or invalid Authorization: Bearer <apiKey> header"}`** — you're POSTing to `/api/funnels` without the header, or with the wrong key. This is also what you'll get if you click "Send" in the extension itself (see Section 6's note) — use `curl` with the header instead.
- **GTM setup page shows an error message with a "Go to Settings" link** — you haven't connected Google Tag Manager yet, or the connection expired. Go to Settings and click Connect Google Tag Manager.
- **`Tag Manager API has not been used in project ... or it is disabled`** — you created the OAuth client but never flipped on the API itself. Go to Google Cloud Console → APIs & Services → Library → search "Tag Manager API" → Enable.

## 8. How to make a change and see it

With `npm run dev` running, edit any file under `app/`, `components/`, or `lib/` in `backend/` and save — Next.js's "Fast Refresh" picks up the change and updates your browser automatically, usually in under a second, without losing your place on the page. No restart needed.

Two exceptions:
- Editing `prisma/schema.prisma` (adding a new database field, for example) needs a fresh migration and a restart: run `npx prisma migrate dev` again, then stop and restart `npm run dev`.
- Editing anything under `extension/` needs a manual reload: go to `chrome://extensions`, click the reload icon on "Funnel Setuper — Recorder", then refresh whatever tab you're testing on. The extension has no hot-reload of its own.

## 9. Where things live

- **The funnel schema** (what fields a funnel/step has) — two places have to agree: `backend/lib/schema.ts` (validates the JSON coming in from the extension) and `backend/prisma/schema.prisma` (the actual database columns). Change both together, then run a new migration.
- **GTM/GA4 integration logic** — everything lives under `backend/lib/gtm/`: `oauth.ts` (the OAuth dance), `api.ts` (raw calls to the Tag Manager API), `plan.ts` (decides create vs. reuse vs. conflict for each step), `resources.ts` (builds the actual trigger/tag JSON bodies sent to Google), `setup.ts` (prepares the draft workspace), `event-name.ts` (default GA4 event names), `url-regex.ts` (turns a captured URL into a matchable pattern).
- **A future integration (e.g. Stape/server-side)** would most naturally live in a new sibling folder like `backend/lib/stape/`, following the same shape as `lib/gtm/` — the `stapeStatus` column and its "pending" pill in `components/FlowDiagram.tsx` are already there waiting for it.
- **Styling** — almost every color and spacing choice comes from CSS variables defined once in `backend/app/globals.css` (`--bg`, `--accent`, `--line-secondary`, etc.); components reference those variables in inline styles rather than separate stylesheets.
- **What counts as a "step" while recording** — `extension/content/content.js` decides what's a click vs. a pageview vs. a form submit; `extension/lib/selector.js` decides what CSS selector to record for a click; `extension/lib/url-pattern.js` decides how a URL gets generalized.

## 10. Glossary

- **Env var (environment variable)** — a named secret or setting (like your Google client ID) that lives outside the code, in a file like `.env.local`, so it's never committed to git.
- **localhost** — a special address (`http://localhost:3000`) that means "this same computer," used for running and testing a site before it's on the real internet.
- **Port** — the specific "door" on your computer a running program listens on (the `3000` in `localhost:3000`); only one program can use a given port at a time.
- **Repo (repository)** — the full folder of code and its history, tracked by git; what you cloned or downloaded to get this project.
- **Commit** — a saved snapshot of changes in the repo's history, with a message describing what changed.
- **Dependency / package** — a piece of someone else's code your project relies on (like Next.js or Prisma); `npm install` downloads all of them based on `package.json`.
- **Migration** — a small, ordered file that changes the database's structure (e.g. "add a `stapeStatus` column"); running them in order is how an empty database becomes one with all the right tables.
- **ORM** — a library (here, Prisma) that lets code read and write the database using normal-looking function calls instead of raw SQL.
- **OAuth** — the "Sign in with Google" style flow where you grant an app specific permissions on a Google service without ever handing the app your password.
- **API endpoint** — a specific URL the server responds to for one purpose (e.g. `POST /api/funnels` to create a funnel); the extension and the dashboard both talk to the app through endpoints like these.
