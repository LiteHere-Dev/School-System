# [School Name] System — V162

## What's new in V162 — Model auto-switching now searches every parameter size

The AI Monitor already knew about all ten installed model families (`deepseek-r1`, `gemma4`, `llama3`, `llama3.2`, `phi4-mini`, `qwen2.5-coder`, `qwen2.5vl`, `qwen2-math`, `qwen3`, `qwen3.5`). What it didn't do reliably was account for *which specific parameter size* of each family is actually on disk:

| Issue | Fix |
|---|---|
| **Assumed an untagged/"latest" tag always exists** | If a family was pulled as a specific size only (e.g. `ollama pull qwen3:8b`, no `qwen3:latest`), every real request — chat replies, the "does this need a web search?" check, warming a model up after a switch — asked Ollama to run bare `qwen3`, which 404s when only `qwen3:8b` exists. There's now a live cache of every tag Ollama actually reports, refreshed on every status check, and a resolver that searches across all parameter sizes pulled for a family and returns a real, runnable tag (preferring an explicit `latest` tag, then the largest parameter size installed). |
| **Auto-switch / vision-attachment checks trusted a static list** | Task-based auto-routing and "is a vision model installed?" both checked a hardcoded list of family names, not what Ollama actually reports. They now verify against the same live cache, so they reflect what's really installed on this machine right now. |
| **AI Monitor's model dropdown gave no installation feedback** | Each entry now shows ✓ or ⚠ plus the resolved parameter size (e.g. "✓ qwen3 (8b)"), so it's visible at a glance which families Ollama can currently see. |

Nothing about how a *family* is chosen changed (routing rules, per-model temperature/context settings, etc. are untouched) — this only fixes how that choice gets turned into a real, working request to Ollama.

# [School Name] System — V160

## What's new in V160 — No delay between AI messages

The AI assistant enforced a 120-second cooldown between messages for every account except the seeded System Administrator (`A-001`), who was already exempt. That cooldown (`AI_RATE_LIMIT_MS`) is now `0`, so everyone can send messages back-to-back with no forced wait. The AI Monitor's "Rate Limit" and "Cooldown Remaining" fields now reflect this (show "None" / "Ready") instead of the old hardcoded 120s. Note Ollama itself still processes one request at a time (`OLLAMA_NUM_PARALLEL: 1`), so a message sent while a previous reply is still generating waits for that reply, not for a cooldown timer.

# [School Name] System — V158

## What's new in V158 — Per-account theme & language

Dark mode and language were previously stored in a way that leaked across accounts on a shared device/browser:

| Issue | Fix |
|---|---|
| **Dark mode was a single global switch** | It was saved under one shared key (`darkmode`) in the server-side data store — the same key for every account. Whoever toggled it last set it for *everyone*, on every device, forever. It's now saved per-account, under a key namespaced to that user's own id (`pref_theme_<userId>`), and reloaded fresh the moment that account signs in. |
| **Language was tied to the browser, not the account** | It only ever lived in that browser's `localStorage`, so two different people signing into the same shared/lab computer would always see whichever language the previous person last picked. It's now saved per-account too (`pref_lang_<userId>`), reloaded on login, and applied before the first page renders. |
| **Upgrade path** | On an existing install, the first time each account signs in after this update, it inherits whatever the old shared theme/browser language happened to be as its own **starting** preference — nothing resets to defaults unexpectedly — but from that point on each account's choice is fully independent. |
| **Login screen (pre-login)** | Before anyone signs in, dark mode still remembers what this specific device last had it set to (its own local, non-account setting), so the toggle on the login screen isn't lost on refresh — it just never gets attached to any account. |
| **Deleted accounts** | Deleting an account now also clears its saved theme/language preference along with its other data. |

## What's new in V157 — Admin page layout fix

The **Backups**, **Migrations**, and **System Health** admin pages (added in V162) were wrapped in a `section-wrap` class that has no matching rule in `1.css` — so unlike every other admin page, they picked up none of the standard page padding/centering and rendered flush against the sidebar instead of centered like Accounts, Staff, etc. All three now use the same `.inner` wrapper class as the rest of the app (with their existing `max-width` kept as an inline override), so they line up visually with the rest of the admin section.

## What's new in V162 — Security follow-ups

Three items flagged as outstanding from the V162 security review:

| Issue | Fix |
|---|---|
| **Missing security headers** | No Content-Security-Policy, no clickjacking/MIME-sniffing protection, and rate limiting only covered login/signup. Every response now sets CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a locked-down `Permissions-Policy`; HSTS is added automatically once the server detects it's being served over HTTPS. A general per-IP rate limit (300 req/min) now wraps *every* route, on top of the existing stricter login/signup limits, so no current or future endpoint is left completely unthrottled. (Implemented by hand rather than pulling in `helmet`, to avoid a new dependency for a fixed, small set of headers — equivalent coverage.) |
| **Bootstrap window still open to any network client** | The pre-seed `/api/kv` bootstrap window (needed so a brand-new install can self-seed its demo dataset before anyone can log in) previously accepted requests from *any* address that could reach the server — meaning a fresh install exposed to a network/the internet before the operator opened it themselves could be seeded by whoever got there first, including with an attacker-controlled admin account. It now additionally requires the bootstrap request to originate from the server's own loopback address; non-loopback attempts are rejected and logged. This matches the intended deployment model (`Start_system.bat` runs the server and the browser on the same machine) — the window still closes permanently the instant seed data exists, exactly as before. |
| **XSS: escaping present but not comprehensively audited** | V162 noted a full line-by-line audit was out of scope. This pass swept every `${...}` interpolation feeding an `innerHTML` render (user names, subjects, class/homeroom labels, announcement titles/bodies, forum category names, staff names, error messages, audit-log entries, etc.) and wrapped the ones missing it in the existing `escapeHtml()` helper — roughly 60 call sites, including the admin Audit Log table, which was rendering `targetName`/`details`/`actorName` unescaped (a stored-XSS path: e.g. a user setting their own display name to markup would execute it in an admin's browser the next time that admin viewed the audit log). Not touched: CSV export (a different vulnerability class, formula/CSV injection, not covered by HTML-escaping) and non-HTML sinks like `showToast`/`confirm()`, which already use `textContent`/native dialogs and were never at risk. |

## What's new in V162 — Terminal colors

Purely cosmetic: the three windows that open at launch (the main `Start_system.bat` launcher window, the Node/PostgreSQL server window, and the Ollama window) now all use a black background with green text, instead of the default white-on-black. No functional changes.

Note: this recolors plain console text (everything the launcher, npm, and our own script print). If Ollama's own log output uses ANSI color codes internally, those lines may still show their own colors rather than green, since an embedded color code overrides the console's default per-line.

## What's new in V162 — Launcher fix & packaging

| Issue | Fix |
|---|---|
| **Ollama terminal failed to launch on install paths containing spaces** | `Start_system.bat` was launching Ollama's logging wrapper as `cmd /k "powershell ... -File ""%~dp0start_ollama.ps1"""` — a doubled-quote-inside-a-quote pattern that Windows' command-line parsing mishandles the instant the install path contains a space (e.g. `D:\Nationals projects\...`), truncating the path at the first space and causing PowerShell to fail with `does not have a '.ps1' extension`. Fixed by launching `powershell.exe` directly instead of double-wrapping through an extra `cmd /k` layer, so the path only needs one level of quoting. |
| **Zip extracted into a wrapping folder** | Packaging now zips the contents of the version folder directly rather than the folder itself, so extracting the `.zip` drops `index.html`, `1.js`, `server.js`, etc. straight into wherever you extract to — no extra `System_V162\` folder to move things out of first. |

## What's new in V162 — Extended authorization

V162 fixed the Critical finding (no auth at all on `/api/kv`) and added field-level protection specifically for the account table. This release extends the same idea to the rest of the sensitive data in the store, since a valid session was still being treated as "fully trusted for everything":

| Resource | Who can write | Notes |
|---|---|---|
| Grades, report cards, gradebooks, homeroom rosters, class notes, announcements | Teachers & admins | Was: any authenticated session, including students |
| Class/homeroom/staff definitions, content-moderation word lists | Admins only | Org-level configuration |
| Assignments | Teachers & admins | Except the submission counter, which a student's own submit action legitimately increments |
| Submissions | Students may create/edit their own; grade/feedback fields are teacher/admin-only | Was: any field, any submission, from any session |
| Forum threads & replies | Anyone may post as themselves; editing/deleting someone else's post is admin-only | The background account-sync feature that updates display names/avatars on any post still works — only actual content and authorship are restricted |
| Audit log | Append-only for non-admins | No editing or deleting history, no forging an entry under someone else's name |

Bulk reads (`GET /api/kv`) were also tightened: a student's session used to receive every other student's grades, report cards, and AI chat history, and the full audit log, in the same response as their own data. Those are now filtered to the record's owner (or teacher/admin) before the response is sent. Everything else keeps the app's original broad read model (classmate rosters, forum posts, etc. — this app's dashboards generally assume that data is visible within the school).

**This pass is based on static analysis of every write call site found in `1.js`, not live testing against a real deployment.** Please exercise login, signup, self password-change, grading, forum posting, and submissions across each role (student/teacher/parent/admin) before relying on this in production — see if anything that used to work now throws a 403 that shouldn't.

## What's new in V162 — Security hardening

This release addresses a security review with one Critical finding and several supporting issues:

| Issue | Fix |
|---|---|
| **Critical: no authentication on `/api/kv`** | The entire application datastore (every user, grade, and forum post — everything) lives under one flat `kv_store` table, and `GET`/`PUT`/`DELETE /api/kv*` had no auth check at all — anyone who could reach the server could read or wipe the whole database. These endpoints now require a valid session. The only exception is a one-time bootstrap window on a brand-new, never-seeded install (so the app can still self-seed its default demo dataset before anyone has ever logged in) — the instant that seed data exists, the window closes permanently. |
| **Privilege escalation via the account table** | Even with auth added, any authenticated session could still rewrite the *entire* `users` table, including granting itself the admin role or setting another account's password. The account table now has field-level authorization: non-admin sessions may only ever change their own password hash; role, email, id, and suspension status are admin-only, on any record. |
| **Plaintext signup passwords** | New accounts were created client-side, with a plaintext `password` field only hashed on first login. Signup is now a dedicated server endpoint (`POST /api/auth/signup`) that validates everything server-side, hashes with bcrypt before the record is ever written, and can only ever create a `student` role account. |
| **Self password-change silently stored plaintext** | The bcrypt-hash utility endpoint was accidentally admin-only, so a non-admin changing their own password got a silent 403 and fell back to storing it unhashed. It's now available to any authenticated session (it's a stateless hashing utility — no admin-specific sensitivity). |
| **JWT secret regenerated on every restart** | With no `JWT_SECRET` set in `.env`, a fresh random secret was generated on every boot, silently invalidating every existing session (force-logging-out everyone) on every restart/crash/deploy. It's now generated once and persisted locally, reused across restarts. Setting `JWT_SECRET` explicitly in `.env` remains the recommended production practice. |
| **No rate limiting on login/signup** | Added a lightweight in-memory per-IP rate limiter (10 login attempts / 5 min, 5 signups / hour). |
| **Decompression / entry-count bombs in archive uploads** | `.gz`/`.tar.gz` decompression used `zlib.gunzipSync()` with no output size limit — a tiny malicious file could expand to gigabytes in memory. It now streams through a bounded gunzip that aborts the instant a hard cap (50 MB) is exceeded. ZIP/TAR entry listing is now capped at 5000 entries to guard against archives crafted with an enormous number of near-empty entries. |

Two related, deliberate scope notes: the previous convenience where bumping the app's internal data version would silently re-seed the database for the next anonymous visitor to load the page no longer works unauthenticated (re-seeding a live install now requires an authenticated admin action) — this was a direct trade-off of closing the critical hole above. And while a spot-check of AI chat, forum, and translation rendering confirmed they already consistently HTML-escape user/AI content before insertion, a full line-by-line XSS audit of the codebase was out of scope for this pass.

## What's new in V162

| Feature | Details |
|---|---|
| **Automatic Ollama session logging** | `Start_system.bat` now launches Ollama through a new `start_ollama.ps1` wrapper instead of calling `ollama serve` directly. The Ollama terminal window looks and behaves exactly as before (same live startup/model/request output), but everything printed to it is now also mirrored, line by line, into a timestamped file under `.\logs\` (e.g. `logs\ollama_session_2026-07-09_14-30-00.log`). A closing summary line is appended to that log when the session ends — whether by typing `exit`, pressing Ctrl+C, or closing the window with the X button. |
| **Removed unused `images\` folder** | The empty top-level `images\` folder (unreferenced anywhere in `index.html`, `1.js`, `1.css`, or `server.js`) has been removed from the package. |

## What's new in V162

| Feature | Details |
|---|---|
| **Fixed (verified): concurrent chat sends piling up against Ollama's single-request queue** | Ollama here runs with `OLLAMA_NUM_PARALLEL:1` — one request at a time. Confirmed directly on the user's machine that a single `/api/generate` call completes in ~40s. The Send button, though, was only disabled deep inside `sendAIMessage()` — after several `await`s, including model auto-routing (itself several 40s+ Ollama calls). During that window, rapid/repeated clicks launched multiple concurrent `sendAIMessage()` calls, each queuing its own generate request behind the others, blowing past the 120s timeout. The button now locks immediately, before any `await`, with every early-return path resetting it. Verified with a standalone concurrency simulation: 5 rapid calls → max 1 in-flight request (previously would have been 5). |

## What's new in V162

| Feature | Details |
|---|---|
| **Fixed (verified, not guessed): "Ollama offline" persisted with zero server logs** | Confirmed with an actual local test: real `server.js` + Postgres + a stand-in Ollama on port 11434. The V162 `/api/ollama/*` proxy required a Bearer auth token (`requireAuth`), but none of the 8 frontend call sites that use it (AI Monitor status check, latency/process poll, model switch × 2, chat, translation, web-search-needed classifier) were ever updated to send one. Every request was rejected with an instant `401 Not authenticated` *before* reaching the route handler — which is exactly why nothing appeared in the server terminal no matter what Ollama was doing. All 8 call sites now send `Authorization: Bearer <token>`, consistent with every other authenticated call in the app. Tested: request-without-token → 401, no log (reproduces the bug exactly as reported); request-with-token + Ollama down → 503 with real diagnostic + server log line; request-with-token + Ollama up → 200 with real model data. |

## What's new in V162

| Feature | Details |
|---|---|
| **Added real diagnostics for Ollama proxy failures** | `server.js` logs the true underlying network error (`e.cause`) for every failed `/api/ollama/*` call, and returns that detail to the browser, where admins see it in the AI Monitor's offline banner. This is what made the V162 diagnosis possible. |

## What's new in V162

| Feature | Details |
|---|---|
| **Fixed: "Ollama offline" persisted even through the V162 proxy** | The V162 proxy was correct in principle, but its default target, `http://localhost:11434`, still failed on Windows: Node's `fetch` frequently resolves `localhost` to the IPv6 loopback (`::1`) first, while Ollama by default only binds `127.0.0.1` (IPv4). That mismatch causes an **instant** connection-refused error — which is exactly why the AI Monitor's "Host Latency" card could show a fast, healthy-looking number (a few ms) while "Ollama Status" still said offline: that number was the round-trip to fail fast on the wrong IP family, not a real round-trip to Ollama. `OLLAMA_URL`'s default is now `http://127.0.0.1:11434`. |
| **Fixed: Host Latency card could look healthy even when Ollama was down** | `fetchOllamaProcesses()` recorded latency on any response from the proxy, including its own 503 "Ollama unreachable" response. Latency is now only recorded when the proxy actually got a healthy response back from Ollama. |
| **Fixed: app still identified itself as V162 everywhere** | The V162 functional fixes (Ollama proxy, login IP capture) were real code changes, but every visible/console version label — the `1.js` boot console banner, the sidebar footer ("BUILD V162"), the `server.js` startup log, and `Start_system.bat`'s feature banner — was never bumped past V162. That's what made it look like "V162 launches V162": the running code genuinely was newer, but nothing on screen or in the console said so. All of these now consistently read V162. |

## What's new in V162

| Feature | Details |
|---|---|
| **Fixed: false "Ollama offline" (and silently failing translation)** | The browser was fetching `http://localhost:11434` directly. That only ever works for someone sitting at the exact machine running Ollama — every other browser's "localhost" is that person's own device, which has no Ollama, so the AI Monitor always reported offline (and dynamic-content translation, which used the same direct call, always silently failed) regardless of Ollama's real status. All Ollama calls (`/api/tags`, `/api/ps`, `/api/generate`) now go through a server-side proxy at `/api/ollama/*` in `server.js`, which runs right next to Ollama. `OLLAMA_URL` is configurable server-side via the `OLLAMA_URL` env var if Ollama ever runs on a different host. |
| **Fixed: login IPs not reliably captured** | `server.js` never called `app.set("trust proxy", ...)`, so if this sits behind any reverse proxy/tunnel, Express had no way to resolve the real client address, and IP parsing was done ad hoc per-route. Trust proxy is now configured (`TRUST_PROXY_HOPS` env var, default 1), and a shared `clientIp()` helper checks `X-Forwarded-For` → `X-Real-IP` → `CF-Connecting-IP` → socket address, in that order, for every login attempt (success and failure) so login history/active sessions capture the real originating IP consistently. |

## What's new in V162

| Feature | Details |
|---|---|
| **Fixed: AI status text stomping translations** | `checkOllamaStatus()` hardcoded the words "Checking...", "Ready", "No model", "Offline", and "🔒 Locked" in English directly, bypassing translation entirely — every status poll (or opening the AI chat widget) silently overwrote whatever language was active, even seconds after a correct translation had just been applied. All five now go through the curated dictionary (`t("aiChecking")`, `t("aiReady")`, etc.), so they're always correct for the active language, independent of whether Ollama is reachable. The same hardcoded "Online"/"Offline" on the AI Monitor page's status card is fixed the same way. |
| **Persistent translation memory** | The AI-translation cache (`_translateCache`) used to live only in memory and reset on every page reload. It's now persisted to `localStorage` (capped at 1,000 entries, oldest dropped first): once any string has been successfully translated by Ollama, it stays translated on every future visit — even if Ollama is offline at the time — instead of only ever working in the exact session it was first translated in. |
| **Model-switch translation warning** | Some installed models (`qwen2-math`, `qwen2.5-coder`) are narrow fine-tunes that trade away general multilingual ability. If an admin manually switches to one of these while a non-English language is active, a warning toast now explains that page translations may suffer — the switch still goes through, it's a heads-up, not a block. |

Worth understanding: genuinely dynamic content (forum posts, audit log detail messages, a page nobody has ever opened in that language before) can only ever be translated by asking Ollama — if Ollama is offline AND that specific text has never been translated before, it will show in English until Ollama is reachable at least once. There's no way around this without Ollama running; the persistent cache above just means that once it *has* been reachable, that content never regresses back to English again.

## What's new in V162

| Feature | Details |
|---|---|
| **Fully automatic language translation** | Previously, only `navigateTo()` (regular tab switches) triggered translation of freshly rendered content — anything rendered another way (modals, `renderClassesPage()`, `viewThread()`, `saveAnnouncement()`, admin polling refreshes, etc.) stayed in English after a language switch. A document-wide `MutationObserver` now watches everything and auto-translates any new or changed text the moment it appears, for as long as a non-English language is active — announcements, forum threads/replies, modals, and any other dynamically-rendered page. Nothing has to call a translation function explicitly anymore; new features get this for free. |
| **No repeat translation calls** | Curated dictionary strings (nav labels, buttons, etc., set by `applyTranslations()`) are now recognised and skipped by the AI content pass instead of being redundantly re-translated. |
| **Admin dashboards excluded from auto-translation** | AI Monitor and System Health poll and re-render every few seconds with fast-changing numeric/timestamp data (VRAM %, uptime counters, network KB/s). Auto-translating that would spam Ollama with a fresh request every few seconds for content that isn't real prose anyway, so both pages are now marked `data-no-translate` and skip the automatic pass entirely (their nav labels still translate normally via the curated dictionary). |

## What's new in V162

| Feature | Details |
|---|---|
| **Archive parsing (ZIP/TAR/GZ/TGZ)** | Archives are no longer rejected outright. `.zip`, `.tar`, `.gz`, and `.tgz`/`.tar.gz` are extracted server-side via `POST /api/documents/parse`: the AI receives a full file listing plus the actual text content of small text-based files inside, with an explicit instruction block telling it the contents are inert data to read/discuss, not commands to execute. Formats without a safe pure-JS extractor (`.rar`, `.7z`, `.iso`, `.cab`) are still allowed to attach — they fall back to filename-only, same as any other unparseable document. |
| **1GB attachment limit** | The AI Chat attachment size cap was raised from 8MB to 1GB (client `MAX_ATTACHMENT_BYTES` and server `PARSE_MAX_INPUT_BYTES`). The server's JSON body limit was raised to `1500mb` to accommodate the ~1.4x overhead of base64 encoding. |

New dependency: `npm install` now also pulls in `adm-zip` and `tar-stream` (pure-JS, no native/shell dependencies) — `Start_system.bat` checks for these automatically and re-runs `npm install` if either is missing.

## What's new in V162

| Feature | Details |
|---|---|
| **AI Chat File / Picture Attachments** | Students/staff can attach a file or picture to the AI chat via the 📎 button. Executable/script formats (.exe, .bat, .sh, etc.) are always rejected client-side. See V162 above for current archive handling and size limit. |
| **Vision-model routing** | Pictures are only understood by a vision-capable model (`qwen2.5vl`). If a different model is active when a picture is attached, the assistant automatically switches to `qwen2.5vl` for that request — the same mechanism as the existing math/code auto-routing. |
| **Document parsing (PDF/Word/Excel)** | `POST /api/documents/parse` extracts real text from `.pdf` (pdf-parse), `.docx` (mammoth), and `.xlsx`/`.xls` (xlsx) so their contents — not just the filename — reach the AI. Output is capped at 15,000 characters per file (30,000 for archives). Legacy `.doc` and `.pptx` aren't supported yet and fall back to filename-only. |

New dependency: `npm install` now also pulls in `pdf-parse`, `mammoth`, and `xlsx` — `Start_system.bat` checks for these automatically and re-runs `npm install` if any are missing.

## What's new in V162

| Feature | Details |
|---|---|
| **System Activity Timeline** | Admin › System Health — every server event (logins, backups, migrations, boot) logged to `system_timeline` with severity, category, actor, and metadata. Filterable by category and severity. |
| **Error Log Dashboard** | Frontend and server errors are persisted to `error_log`. Admins can view, filter by level, and mark errors as resolved. Stack traces are stored and expandable. |
| **Server Health Monitoring** | `GET /api/system/health` — uptime, memory (heap, RSS), Node version, PID, platform. Auto-refreshes every 15 s in the UI. |
| **Database Health Monitoring** | `GET /api/system/db-health` — pg ping latency, DB size, connection counts, blocked locks, per-table row counts and sizes. |
| **Automatic Backups** | Server creates a full `kv_store` snapshot 30 s after boot, then every 24 h automatically. Up to 30 auto-backups are kept; older ones are pruned. |
| **Backup Restore System** | Admin › Backups — list all backups, create manual ones, restore any snapshot (with confirmation), delete old ones. |
| **Database Migration System** | Admin › Migrations — apply raw SQL migrations with version numbers. Optional DOWN SQL enables rollback. All migrations are logged with who applied them and when. |

## New API endpoints

```
GET  /api/system/health           — server health (public)
GET  /api/system/db-health        — database health (admin)
GET  /api/system/timeline         — activity log (admin)
POST /api/system/timeline         — add custom event (admin)
GET  /api/system/errors           — error log (admin)
POST /api/system/errors           — log error (no auth — used by frontend)
PATCH /api/system/errors/:id/resolve
DELETE /api/system/errors/:id

GET  /api/backups                 — list backups (admin)
POST /api/backups/run             — create manual backup (admin)
GET  /api/backups/:id             — get full backup (admin)
POST /api/backups/restore/:id     — restore a backup (admin)
DELETE /api/backups/:id           — delete backup (admin)

GET  /api/migrations              — list migrations (admin)
POST /api/migrations              — apply migration (admin)
POST /api/migrations/:version/rollback — rollback (admin)

POST /api/documents/parse         — extract text from pdf/docx/xlsx (any logged-in user)
```

## New database tables

Applied automatically on server boot (or run `schema.sql` manually):

- `system_timeline` — every loggable event
- `error_log` — server + frontend errors
- `backups` — snapshot store (kv_store data as JSONB)
- `migration_history` — applied schema changes

## One-time setup (same as V162)

### 1. Install prerequisites
- [Node.js](https://nodejs.org) 18+
- [PostgreSQL](https://www.postgresql.org/download/) 14+

### 2. Create the database
```sql
CREATE DATABASE school_db;
CREATE USER school_user WITH PASSWORD 'change_me';
GRANT ALL PRIVILEGES ON DATABASE school_db TO school_user;
\c school_db
GRANT ALL ON SCHEMA public TO school_user;
```

### 3. Configure .env
Copy `.env.example` to `.env` and fill in your credentials:
```
DATABASE_URL=postgresql://school_user:change_me@localhost:5432/school_db
JWT_SECRET=<long random string>
PORT=8000
```

Generate a JWT secret:
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4. Install dependencies
```
npm install
```

### 5. Start
Double-click **Start_system.bat** or run:
```
npm start
```
Then open http://localhost:8000/

## Upgrading from V162

No manual steps needed — new tables are created automatically on first boot.
Your existing data is untouched. The first auto-backup runs 30 seconds after startup.
