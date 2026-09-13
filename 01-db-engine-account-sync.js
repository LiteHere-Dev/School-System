/* =====================================================================
   School Management System — Application Logic
   File: 1.js
   NOTE: This file depends on functions defined in seed-data.js
   (seedDatabase, seedGradebookClasses, seedClassNotes, seedHomerooms,
   hrRand). Make sure seed-data.js is loaded BEFORE this file in index.html.

   STORAGE: All app data is persisted to PostgreSQL through the small
   Express API in server.js (GET/PUT/DELETE /api/kv...) — see the DB
   object below. This replaced the previous localStorage-based engine;
   see server.js, schema.sql and SETUP.md for the backend side of this.
   =====================================================================
*/
console.log("%c[SMS] Build V162 loaded from 1.js", "background:#8b1a2c;color:#fff;font-size:14px;padding:4px 10px;border-radius:4px;font-weight:bold");

      // ─── DATABASE ENGINE (PostgreSQL-backed, via local API server) ─
      // ══════════════════════════════════════════════════════════════
      // Storage moved off localStorage entirely. The whole key/value
      // store now lives in a Postgres table (kv_store), served by the
      // small Express API in server.js (GET/PUT/DELETE /api/kv...).
      //
      // To avoid rewriting every one of the ~280 call sites elsewhere
      // in this app (which all assume DB.get/set/del/keys are perfectly
      // synchronous), DB keeps an in-memory cache that is:
      //   1. Hydrated once from Postgres via DB.init() at page load
      //      (awaited before seedDatabase()/the rest of boot runs — see
      //      the bootApp() IIFE further down).
      //   2. Read synchronously from then on (DB.get/keys never touch
      //      the network — they read the cache, exactly like the old
      //      localStorage version did).
      //   3. Written synchronously to the cache AND asynchronously
      //      persisted to Postgres in the background on every
      //      DB.set/DB.del, with automatic retry (so a brief network
      //      hiccup doesn't silently lose a write) and a status flag
      //      the login-screen "Database connected" badge reflects.
      const DB = {
        _cache: {},
        _ready: false,
        _readyPromise: null,
        _pending: new Set(), // keys currently mid-retry / failing to persist
        _authExpired: false, // true once a 401 tells us the current session is no longer valid

        // Auth header for every /api/kv call. Before login this is empty
        // (fine — the server allows unauthenticated /api/kv access ONLY
        // during the one-time bootstrap window on a brand-new, unseeded
        // install; every other request needs this). See server.js for
        // the corresponding requireAuthUnlessBootstrapping middleware.
        _authHeaders() {
          return window._authToken ? { Authorization: "Bearer " + window._authToken } : {};
        },

        // Hydrate the in-memory cache from PostgreSQL. Call once; safe to
        // call again (returns the same in-flight/resolved promise).
        init() {
          if (this._readyPromise) return this._readyPromise;
          this._readyPromise = (async () => {
            const res = await fetch("/api/kv", { headers: this._authHeaders() });
            if (res.status === 401) {
              // Expected pre-login on an already-seeded (i.e. normal,
              // already-in-use) install — not a real error. The login
              // screen doesn't need the data cache at all; DB.reinit()
              // is called again right after a successful login, once we
              // actually have a token.
              const e = new Error("Not authenticated yet");
              e.isAuthRequired = true;
              throw e;
            }
            if (!res.ok) throw new Error("GET /api/kv failed: " + res.status);
            const data = await res.json();
            // Merge rather than replace, in case anything was optimistically
            // written into the cache before hydration finished (e.g. a very
            // fast dark-mode toggle on the login screen) — local wins.
            this._cache = Object.assign({}, data || {}, this._cache);
            this._ready = true;
          })();
          return this._readyPromise;
        },

        // Forces a fresh init() call — used right after login, since a
        // pre-login init() attempt (unauthenticated, on an already-seeded
        // install) intentionally fails with 401 and init() otherwise
        // memoizes that failed promise forever.
        reinit() {
          this._readyPromise = null;
          this._ready = false;
          this._authExpired = false;
          return this.init();
        },

        get(key) {
          return Object.prototype.hasOwnProperty.call(this._cache, key)
            ? this._cache[key]
            : null;
        },
        set(key, val) {
          this._cache[key] = val;
          this._persist(key, val);
          return true;
        },
        del(key) {
          delete this._cache[key];
          this._persistDelete(key);
          return true;
        },
        keys(prefix = "") {
          return Object.keys(this._cache).filter((k) => k.startsWith(prefix));
        },

        async _persist(key, val, attempt = 0) {
          try {
            const res = await fetch("/api/kv/" + encodeURIComponent(key), {
              method: "PUT",
              headers: Object.assign({ "Content-Type": "application/json" }, this._authHeaders()),
              body: JSON.stringify(val === undefined ? null : val),
            });
            if (res.status === 401) { this._onAuthExpired(); return; }
            if (!res.ok) throw new Error("status " + res.status);
            this._pending.delete(key);
          } catch (e) {
            this._pending.add(key);
            if (attempt < 5) {
              setTimeout(
                () => this._persist(key, val, attempt + 1),
                Math.min(1000 * 2 ** attempt, 15000),
              );
            } else {
              console.error("[DB] Gave up saving key to server:", key, e);
            }
          } finally {
            updateDbBadge();
          }
        },
        async _persistDelete(key, attempt = 0) {
          try {
            const res = await fetch("/api/kv/" + encodeURIComponent(key), {
              method: "DELETE",
              headers: this._authHeaders(),
            });
            if (res.status === 401) { this._onAuthExpired(); return; }
            if (!res.ok && res.status !== 404)
              throw new Error("status " + res.status);
            this._pending.delete(key);
          } catch (e) {
            this._pending.add(key);
            if (attempt < 5) {
              setTimeout(
                () => this._persistDelete(key, attempt + 1),
                Math.min(1000 * 2 ** attempt, 15000),
              );
            } else {
              console.error("[DB] Gave up deleting key on server:", key, e);
            }
          } finally {
            updateDbBadge();
          }
        },

        // A 401 here means the session token is missing/expired — no
        // point burning through retry attempts against a token that will
        // never become valid again. Surface it plainly and send the
        // person back to the login screen instead of silently stalling
        // on a "Saving... pending" badge forever.
        _onAuthExpired() {
          if (this._authExpired) return;
          this._authExpired = true;
          console.warn("[DB] Session expired or invalid — please log in again.");
          if (typeof doLogout === "function" && typeof currentUser !== "undefined" && currentUser) {
            showToast("⚠️ Your session expired — please log in again.", "err");
            doLogout(false);
          }
        },
      };

      // Reflects live PostgreSQL connection / sync status in the
      // login screen's "Database connected" badge.
      function updateDbBadge() {
        const badge = document.getElementById("db-status");
        if (!badge) return;
        if (!DB._ready && !currentUser) {
          // Pre-login: DB.init() intentionally isn't hydrated on an
          // already-seeded (i.e. normal) install — that's expected, not
          // an error. Server reachability is confirmed separately by
          // /api/auth/login itself when the person actually signs in.
          badge.className = "db-badge db-ok";
          badge.innerHTML =
            '<div class="db-dot db-dot-ok"></div> Ready to sign in';
        } else if (!DB._ready) {
          badge.className = "db-badge db-err";
          badge.innerHTML =
            '<div class="db-dot db-dot-err"></div> Connecting to database…';
        } else if (DB._pending.size > 0) {
          badge.className = "db-badge db-err";
          badge.innerHTML =
            '<div class="db-dot db-dot-err"></div> Saving… (' +
            DB._pending.size +
            " pending)";
        } else {
          badge.className = "db-badge db-ok";
          badge.innerHTML =
            '<div class="db-dot db-dot-ok"></div> Database connected (PostgreSQL)';
        }
      }

      // ─── DB HELPERS ──────────────────────────────────────
      function dbGetList(key) {
        return DB.get(key) || [];
      }
      function dbSaveList(key, list) {
        return DB.set(key, list);
      }
      function dbGenId(prefix) {
        return (
          prefix +
          "_" +
          Date.now() +
          "_" +
          Math.random().toString(36).slice(2, 6)
        );
      }
      function timeAgo(ts) {
        const d = Date.now() - ts,
          m = Math.floor(d / 60000),
          h = Math.floor(d / 3600000),
          day = Math.floor(d / 86400000);
        if (d < 60000) return "just now";
        if (m < 60) return m + "m ago";
        if (h < 24) return h + "h ago";
        if (day < 7) return day + "d ago";
        return new Date(ts).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });
      }
      function escapeHtml(str) {
        return String(str === null || str === undefined ? "" : str).replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c],
        );
      }

      // ══════════════════════════════════════════════════════
      // ─── STUDENT IDENTITY SYNC ────────────────────────────
      // Homeroom and Gradebook rosters store their own lightweight
      // copy of each student (name/initials/avatar) so the class
      // tables render fast. When a roster row is linked to a real
      // account (entry.userId), resolveStudent() always reads the
      // live name/initials/avatar/ID straight from the `users`
      // table — so editing a student once in Admin → Accounts
      // (or anywhere else that edits the account) is reflected
      // everywhere that student is listed, with nothing to
      // separately "push" or forget to update.
      // ══════════════════════════════════════════════════════
      function usersByIdMap() {
        const map = {};
        dbGetList("users").forEach((u) => (map[u.id] = u));
        return map;
      }
      // ════════════════════════════════════════════════════════════
      // ─── ACCOUNT SYNC ENGINE ────────────────────────────────────
      // ════════════════════════════════════════════════════════════

      /*  Sync a user account's core fields (name, initials, avatar, uid)
          to every linked roster entry (homeroom + gradebook) and to
          forum posts/replies + parent childName references.
          Call this AFTER editing a user account and saving users[].  */
      function syncAccountToAllRosters(userId) {
        const users = dbGetList("users");
        const user = users.find((u) => u.id === userId);
        if (!user) return;

        let syncCount = 0;

        // ── 1. Sync homeroom rosters ──
        dbGetList("homerooms").forEach((h) => {
          const key = "homeroom_" + h.id;
          const roster = dbGetList(key);
          let changed = false;
          roster.forEach((s) => {
            if (s.userId === userId) {
              if (s.name !== user.name) { s.name = user.name; changed = true; }
              if (s.init !== user.initials) { s.init = user.initials; changed = true; }
              if (s.av !== user.av) { s.av = user.av; changed = true; }
              if (user.uid && s.uid !== user.uid) { s.uid = user.uid; changed = true; }
            }
          });
          if (changed) { dbSaveList(key, roster); syncCount++; }
        });

        // ── 2. Sync gradebook rosters ──
        dbGetList("gb_classes").forEach((c) => {
          const key = "gradebook_" + c.id;
          const roster = dbGetList(key);
          let changed = false;
          roster.forEach((s) => {
            if (s.userId === userId) {
              if (s.name !== user.name) { s.name = user.name; changed = true; }
              if (s.init !== user.initials) { s.init = user.initials; changed = true; }
              if (s.av !== user.av) { s.av = user.av; changed = true; }
            }
          });
          if (changed) { dbSaveList(key, roster); syncCount++; }
        });

        // ── 3. Sync forum threads (author + replies) ──
        const threads = dbGetList("forum_threads");
        let threadsChanged = false;
        threads.forEach((t) => {
          if (t.authorId === userId) {
            if (t.author !== user.name) { t.author = user.name; threadsChanged = true; }
            if (t.av !== user.av) { t.av = user.av; threadsChanged = true; }
          }
          if (t.replies && t.replies.length) {
            t.replies.forEach((r) => {
              if (r.authorId === userId) {
                if (r.author !== user.name) { r.author = user.name; threadsChanged = true; }
                if (r.av !== user.av) { r.av = user.av; threadsChanged = true; }
              }
            });
          }
        });
        if (threadsChanged) { dbSaveList("forum_threads", threads); syncCount++; }

        // ── 4. Sync parent accounts (childName) ──
        let parentsChanged = false;
        users.forEach((u) => {
          if (u.role === "parent" && u.childId === userId && u.childName !== user.name) {
            u.childName = user.name;
            parentsChanged = true;
          }
        });
        if (parentsChanged) { dbSaveList("users", users); syncCount++; }

        // ── 5. Sync staff directory (name match for linked teacher accounts) ──
        const staff = dbGetList("staff");
        let staffChanged = false;
        staff.forEach((s) => {
          // Link staff to user accounts by name for now
          const linkedUser = users.find((u) => u.role === "teacher" && u.name === s.name);
          if (linkedUser && linkedUser.id === userId && s.name !== user.name) {
            s.name = user.name;
            staffChanged = true;
          }
        });
        if (staffChanged) { dbSaveList("staff", staff); syncCount++; }

        return syncCount;
      }

      /*  Cascade-delete every reference to a user account across
          ALL data stores. COMPLETELY removes forum posts, report cards,
          grades, submissions, announcements, audit logs, and staff entries.
          Call this BEFORE removing the user from users[].  */
      function cascadeDeleteAccount(userId) {
        let delCount = 0;

        // ── 1. Remove from homeroom rosters ──
        dbGetList("homerooms").forEach((h) => {
          const key = "homeroom_" + h.id;
          const roster = dbGetList(key);
          const filtered = roster.filter((s) => s.userId !== userId);
          if (filtered.length !== roster.length) {
            dbSaveList(key, filtered);
            delCount++;
          }
        });

        // ── 2. Remove from gradebook rosters ──
        dbGetList("gb_classes").forEach((c) => {
          const key = "gradebook_" + c.id;
          const roster = dbGetList(key);
          const filtered = roster.filter((s) => s.userId !== userId);
          if (filtered.length !== roster.length) {
            dbSaveList(key, filtered);
            delCount++;
          }
        });

        // ── 3. COMPLETELY DELETE forum threads & replies by this user ──
        let threads = dbGetList("forum_threads");
        const originalLen = threads.length;
        // Remove threads where user is the author
        threads = threads.filter((t) => t.authorId !== userId);
        // Remove replies where user is the author
        threads.forEach((t) => {
          if (t.replies && t.replies.length) {
            t.replies = t.replies.filter((r) => r.authorId !== userId);
          }
        });
        if (threads.length !== originalLen) {
          dbSaveList("forum_threads", threads);
          delCount++;
        }

        // ── 4. Clear parent childId references ──
        const users = dbGetList("users");
        let parentsChanged = false;
        users.forEach((u) => {
          if (u.role === "parent" && u.childId === userId) {
            u.childId = null;
            u.childName = null;
            parentsChanged = true;
          }
        });
        if (parentsChanged) { dbSaveList("users", users); delCount++; }

        // ── 5. Delete per-student grades data ──
        const gradeKeys = DB.keys("grades_");
        gradeKeys.forEach((key) => {
          if (key === "grades_" + userId) {
            DB.del(key);
            delCount++;
          }
        });

        // ── 6. Delete report cards for this student ──
        DB.del("report_card_" + userId);

        // ── 7. Delete submissions for this student ──
        const submissions = dbGetList("submissions");
        const filteredSubs = submissions.filter((s) => s.studentId !== userId);
        if (filteredSubs.length !== submissions.length) {
          dbSaveList("submissions", filteredSubs);
          delCount++;
        }

        // ── 8. Delete assignments created by this user ──
        const assignments = dbGetList("assignments");
        const filteredAssign = assignments.filter((a) => a.createdBy !== userId);
        if (filteredAssign.length !== assignments.length) {
          dbSaveList("assignments", filteredAssign);
          delCount++;
        }

        // ── 9. Delete class notes for this user ──
        const notes = dbGetList("class_notes");
        const filteredNotes = notes.filter((n) => n.createdBy !== userId);
        if (filteredNotes.length !== notes.length) {
          dbSaveList("class_notes", filteredNotes);
          delCount++;
        }

        // ── 10. Delete announcements created by this user ──
        const anns = dbGetList("announcements");
        const filteredAnns = anns.filter((a) => a.createdBy !== userId);
        if (filteredAnns.length !== anns.length) {
          dbSaveList("announcements", filteredAnns);
          delCount++;
        }

        // ── 11. Delete audit log entries mentioning this user ──
        const auditLog = dbGetList("audit_log");
        const filteredAudit = auditLog.filter((e) => e.actorId !== userId && e.targetId !== userId);
        if (filteredAudit.length !== auditLog.length) {
          dbSaveList("audit_log", filteredAudit);
          delCount++;
        }

        // ── 12. Delete staff directory entry for this user (matched by name or userId) ──
        const userToDelete = users.find((u) => u.id === userId);
        if (userToDelete) {
          const staff = dbGetList("staff");
          const filteredStaff = staff.filter((s) => {
            // Keep staff entries that don't match this user's name
            return s.name !== userToDelete.name;
          });
          if (filteredStaff.length !== staff.length) {
            dbSaveList("staff", filteredStaff);
            delCount++;
          }
        }

        // ── 13. Remove teacher assignments from gb_classes ──
        if (userToDelete && userToDelete.role === "teacher") {
          const gbClasses = dbGetList("gb_classes");
          let gbChanged = false;
          gbClasses.forEach((c) => {
            if (c.teacherName === userToDelete.name) {
              c.teacherName = null;
              c.teacherId = null;
              gbChanged = true;
            }
          });
          if (gbChanged) { dbSaveList("gb_classes", gbClasses); delCount++; }
        }

        // ── 14. Delete AI conversation history for this user ──
        DB.del("ai_conv_" + userId);

        // ── 15. Delete this account's own theme/language preferences ──
        DB.del("pref_theme_" + userId);
        DB.del("pref_lang_" + userId);

        return delCount;
      }

      /*  One-time migration: for all existing accounts, push their
          current name/initials/avatar to every linked roster entry.
          Also links previously-unlinked roster entries by name.
          Runs automatically when DB version changes.  */
      function runAccountSyncMigration() {
        console.log("[Sync] Running account sync migration...");
        const users = dbGetList("users");
        const usersByName = {};
        users.forEach((u) => { usersByName[u.name] = u; });

        let totalSyncs = 0;

        // ── Re-link rosters by name (catches previously unlinked entries) ──
        const allClasses = [
          ...dbGetList("homerooms").map((h) => ({ key: "homeroom_" + h.id, classId: h.id })),
          ...dbGetList("gb_classes").map((c) => ({ key: "gradebook_" + c.id, classId: c.id })),
        ];

        allClasses.forEach(({ key }) => {
          const roster = dbGetList(key);
          if (!roster || !roster.length) return;
          let changed = false;
          roster.forEach((s) => {
            if (s.userId) {
              // Already linked — ensure sync
              const live = users.find((u) => u.id === s.userId);
              if (live) {
                if (s.name !== live.name) { s.name = live.name; changed = true; }
                if (s.init !== live.initials) { s.init = live.initials; changed = true; }
                if (s.av !== live.av) { s.av = live.av; changed = true; }
              }
            } else {
              // Not linked — try to match by name
              const match = users.find((u) => u.name === s.name);
              if (match) {
                s.userId = match.id;
                s.name = match.name;
                s.init = match.initials;
                s.av = match.av;
                if (s.uid !== undefined) s.uid = match.uid || s.uid;
                changed = true;
              }
            }
          });
          if (changed) { dbSaveList(key, roster); totalSyncs++; }
        });

        // ── Sync forum thread authors ──
        const threads = dbGetList("forum_threads");
        let threadsChanged = false;
        threads.forEach((t) => {
          if (t.authorId) {
            const live = users.find((u) => u.id === t.authorId);
            if (live) {
              if (t.author !== live.name) { t.author = live.name; threadsChanged = true; }
              if (t.av !== live.av) { t.av = live.av; threadsChanged = true; }
            }
          }
          if (t.replies && t.replies.length) {
            t.replies.forEach((r) => {
              if (r.authorId) {
                const live = users.find((u) => u.id === r.authorId);
                if (live) {
                  if (r.author !== live.name) { r.author = live.name; threadsChanged = true; }
                  if (r.av !== live.av) { r.av = live.av; threadsChanged = true; }
                }
              }
            });
          }
        });
        if (threadsChanged) { dbSaveList("forum_threads", threads); totalSyncs++; }

        // ── Sync parent childName fields ──
        let parentsChanged = false;
        users.forEach((u) => {
          if (u.role === "parent" && u.childId) {
            const child = users.find((x) => x.id === u.childId);
            if (child && u.childName !== child.name) {
              u.childName = child.name;
              parentsChanged = true;
            }
          }
        });
        if (parentsChanged) { dbSaveList("users", users); totalSyncs++; }

        console.log("[Sync] Migration complete. Synced " + totalSyncs + " data stores.");
        return totalSyncs;
      }

      function resolveStudent(entry, usersById) {
        if (entry.userId) {
          const live = usersById
            ? usersById[entry.userId]
            : dbGetList("users").find((u) => u.id === entry.userId);
          if (live) {
            return {
              id: live.id,
              name: live.name,
              init: live.initials,
              av: live.av,
              uid: live.uid || entry.uid,
            };
          }
        }
        return {
          id: entry.userId || null,
          name: entry.name,
          init: entry.init,
          av: entry.av,
          uid: entry.uid,
        };
      }
      // Moves a linked roster entry between class rosters when a
      // student's account `cls` changes (e.g. promoted, transferred).
      // Removes them from the old class's roster(s) and adds a fresh
      // linked entry to the new class's roster(s), if those classes
      // are tracked as homeroom/gradebook rosters.
      function moveStudentBetweenRosters(userId, oldCls, newCls) {
        if (!userId || oldCls === newCls) return;
        const user = dbGetList("users").find((u) => u.id === userId);
        if (!user) return;

        if (oldCls) {
          const oldHr = dbGetList("homerooms").find((h) => h.id === oldCls);
          if (oldHr) {
            const key = "homeroom_" + oldHr.id;
            dbSaveList(
              key,
              dbGetList(key).filter((s) => s.userId !== userId),
            );
          }
          const oldGb = dbGetList("gb_classes").find((c) => c.id === oldCls);
          if (oldGb) {
            const key = "gradebook_" + oldGb.id;
            dbSaveList(
              key,
              dbGetList(key).filter((s) => s.userId !== userId),
            );
          }
        }

        if (newCls) {
          const newHr = dbGetList("homerooms").find((h) => h.id === newCls);
          if (newHr) {
            const key = "homeroom_" + newHr.id;
            const roster = dbGetList(key);
            if (!roster.some((s) => s.userId === userId)) {
              roster.push({
                id: dbGenId("hs"),
                uid:
                  user.uid ||
                  newHr.id + "-" + String(roster.length + 1).padStart(3, "0"),
                name: user.name,
                init: user.initials,
                av: user.av,
                userId: user.id,
              });
              dbSaveList(key, roster);
            }
          }
          const newGb = dbGetList("gb_classes").find((c) => c.id === newCls);
          if (newGb) {
            const key = "gradebook_" + newGb.id;
            const roster = dbGetList(key);
            if (!roster.some((s) => s.userId === userId)) {
              roster.push({
                id: dbGenId("s"),
                name: user.name,
                init: user.initials,
                av: user.av,
                scores: newGb.cols.map(() => 0),
                userId: user.id,
              });
              dbSaveList(key, roster);
            }
          }
        }
      }

      // ─── TOAST ───────────────────────────────────────────
      function showToast(msg, type = "ok") {
        const t = document.getElementById("toast");
        t.textContent = msg;
        t.className = `toast toast-${type} show`;
        setTimeout(() => {
          t.className = "toast";
        }, 3000);
      }

      // ─── CREDENTIALS & LOGIN ─────────────────────────────
      const ROLE_EMAILS = {
        student: "",
        teacher: "",
        parent: "",
        admin: "admin@yourschool.com",
      };
      const ROLE_PASSWORDS = {
        student: "Student123",
        teacher: "Teacher123",
        parent: "Parent123",
        admin: "Admin123",
      };

      let role = "student";
      let currentUser = null;
      let currentGradebookClass = null;
      // ── JWT session state ──────────────────────────────────────────
      let _sessionToken = null;   // JWT returned by /api/auth/login
      let _sessionId    = null;   // session UUID
      let _sessionPoll  = null;   // setInterval handle for force-logout polling

      /** Store JWT after login. */
      function _setSession(token, sessionId) {
        _sessionToken = token;
        window._authToken = token; // expose for V162 system pages
        _sessionId    = sessionId;
        // Poll every 20 s to detect admin force-logout
        if (_sessionPoll) clearInterval(_sessionPoll);
        _sessionPoll = setInterval(async () => {
          if (!_sessionToken) return;
          try {
            const r = await fetch("/api/auth/session-status", {
              headers: { Authorization: "Bearer " + _sessionToken }
            });
            if (r.ok) {
              const d = await r.json();
              if (d.forceLogout) {
                clearInterval(_sessionPoll);
                _sessionPoll = null;
                _sessionToken = null;
                _sessionId    = null;
                doLogout(true); // true = triggered by force-logout
              }
            }
          } catch { /* network hiccup — ignore */ }
        }, 20000);
      }

      /** Clear session on logout. */
      function _clearSession() {
        if (_sessionPoll) { clearInterval(_sessionPoll); _sessionPoll = null; }
        // Fire-and-forget invalidate on server
        if (_sessionToken) {
          fetch("/api/auth/logout", {
            method: "POST",
            headers: { Authorization: "Bearer " + _sessionToken }
          }).catch(() => {});
        }
        _sessionToken = null;
        _sessionId    = null;
      }

      let gradebookShowReportCards = false;
      let studentGradesShowReportCard = false;

      function setRole(r, el) {
        role = r;
        document
          .querySelectorAll(".role-tab")
          .forEach((t) => t.classList.remove("active"));
        el.classList.add("active");
        document.getElementById("em").value = ROLE_EMAILS[r];
        document.getElementById("pw").value = "";
        document.getElementById("pw").placeholder =
          ROLE_PASSWORDS[r] || "••••••••";
        document.getElementById("login-err").style.display = "none";
        const prompt = document.getElementById("signup-prompt");
        if (prompt)
          prompt.style.visibility = r === "student" ? "visible" : "hidden";
      }

      async function doLogin() {
        const em  = document.getElementById("em").value.trim().toLowerCase();
        const pw  = document.getElementById("pw").value.trim();
        const err = document.getElementById("login-err");

        if (!pw) {
          err.textContent = "⚠️ Please enter your password.";
          err.style.display = "block";
          return;
        }

        // Disable button to prevent double-submit
        const btn = document.getElementById("login-btn");
        if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }

        try {
          const resp = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: em, password: pw, role })
          });
          const data = await resp.json();

          if (!resp.ok) {
            if (resp.status === 403) {
              err.textContent = "⚠️ Your account has been suspended" +
                (data.suspendedReason ? ": " + data.suspendedReason : ". Please contact the school office.");
            } else {
              err.textContent = "⚠️ Incorrect email/ID or password. Please try again.";
            }
            err.style.display = "block";
            return;
          }

          // Success — store JWT session
          _setSession(data.token, data.sessionId);
          currentUser = data.user;
          role = data.user.role;
          err.style.display = "none";

          // Now that we have a real session token, (re)hydrate the shared
          // data cache — pre-login this was intentionally blocked (see
          // requireAuthUnlessBootstrapping in server.js) on any install
          // that already has real data in it.
          btn && (btn.textContent = "Loading your data…");
          try {
            await DB.reinit();
            OLLAMA_MODEL = "llama3.2";
            DB.set("ollama_model", "llama3.2");
            webSecState = Object.assign(webSecState, DB.get("websec_state") || {});
            blacklistState = Object.assign(blacklistState, DB.get("blacklist_state") || {});
            seedDatabase(); // no-op if already seeded — safety net for a first-ever login racing seeding
            runAccountSyncMigration();
            initAccountLanguage();
          } catch (e) {
            console.error("[DB] Could not load app data after login:", e);
            err.textContent = "⚠️ Signed in, but couldn't load app data. Please refresh and try again.";
            err.style.display = "block";
            return;
          }

          // Clean AI slate for new user
          aiMessageHistory = [];
          const aiContainer = document.getElementById("ai-messages");
          if (aiContainer) {
            aiContainer.innerHTML = `
              <div class="ai-welcome">
                <div class="ai-welcome-icon">🎓</div>
                <div class="ai-welcome-title">Your School AI Assistant</div>
                <div class="ai-welcome-text">
                  Ask me anything about your subjects, grades, or school life.<br />
                  All conversations stay on your device — nothing is sent to the cloud.
                </div>
                <div class="ai-suggestions">
                  <span class="ai-suggestion" onclick="sendSuggestion('Explain my grades')">Explain my grades</span>
                  <span class="ai-suggestion" onclick="sendSuggestion('Help with trigonometry')">Trig help</span>
                  <span class="ai-suggestion" onclick="sendSuggestion('Homework help')">Homework help</span>
                  <span class="ai-suggestion" onclick="sendSuggestion('Study tips for IGCSE')">IGCSE tips</span>
                </div>
              </div>`;
          }

          document.getElementById("login-screen").style.display = "none";
          document.getElementById("app").style.display = "flex";
          document.getElementById("ai-widget").style.display = "flex";
          initDarkMode();
          buildShell();
          navigateTo("dashboard");
          applyTranslations();
          showToast(`Welcome back, ${data.user.name}! 👋`);
          initAI();
          startBlacklistScanner();
        } catch (e) {
          err.textContent = "⚠️ Network error — could not reach server.";
          err.style.display = "block";
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = "Sign In"; }
        }
      }

      function doLogout(forcedByAdmin = false) {
        // Invalidate session on server
        _clearSession();

        // Wipe AI conversation
        aiMessageHistory = [];
        const aiContainer = document.getElementById("ai-messages");
        if (aiContainer) {
          aiContainer.innerHTML = `
            <div class="ai-welcome">
              <div class="ai-welcome-icon">🎓</div>
              <div class="ai-welcome-title">Your School AI Assistant</div>
              <div class="ai-welcome-text">
                Ask me anything about your subjects, grades, or school life.<br />
                All conversations stay on your device — nothing is sent to the cloud.
              </div>
              <div class="ai-suggestions">
                <span class="ai-suggestion" onclick="sendSuggestion('Explain my grades')">Explain my grades</span>
                <span class="ai-suggestion" onclick="sendSuggestion('Help with trigonometry')">Trig help</span>
                <span class="ai-suggestion" onclick="sendSuggestion('Homework help')">Homework help</span>
                <span class="ai-suggestion" onclick="sendSuggestion('Study tips for IGCSE')">IGCSE tips</span>
              </div>
            </div>`;
        }
        if (aiOpen) toggleAI();

        currentUser = null;
        currentGradebookClass = null;
        stopBlacklistScanner();
        document.getElementById("app").style.display = "none";
        document.getElementById("ai-widget").style.display = "none";
        document.getElementById("login-screen").style.display = "flex";
        document.getElementById("pw").value = "";

        // Back to the login screen — fall back to this device's own
        // theme/language, not whichever account was just signed out of.
        // (Each account's own preference is reloaded fresh on its next
        // sign-in by initDarkMode()/initAccountLanguage().)
        currentLang = localStorage.getItem("sms_lang") || "en";
        const deviceTheme = localStorage.getItem("sms_theme_device");
        const wantDark = deviceTheme
          ? deviceTheme === "dark"
          : window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (wantDark) document.documentElement.setAttribute("data-theme", "dark");
        else document.documentElement.removeAttribute("data-theme");
        document.querySelectorAll(".dm-toggle").forEach((btn) => {
          btn.textContent = wantDark ? "☀️" : "🌙";
        });

        if (forcedByAdmin) {
          // Show a prominent notice on the login screen
          setTimeout(() => {
            const err = document.getElementById("login-err");
            if (err) {
              err.textContent = "⚠️ You have been logged out by an administrator.";
              err.style.display = "block";
            }
          }, 100);
        }
      }

      // ─── STUDENT SIGN UP ─────────────────────────────────
      function openSignup() {
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "signup-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:440px">
      <div class="modal-title">📚 Create Student Account</div>
      <div class="field"><label>Full Name</label><input id="su-name" placeholder="e.g. Sipho Dlamini"></div>
      <div class="field"><label>Email Address</label><input type="email" id="su-email" placeholder="your@email.com"></div>
      <div class="frow">
        <div class="ffield"><div class="flabel">Form</div>
          <select class="finput" id="su-form">
            <option>Form 1</option><option>Form 2</option><option>Form 3</option>
            <option selected>Form 4</option><option>Form 5</option><option>Form 6</option>
          </select>
        </div>
        <div class="ffield"><div class="flabel">Class</div><input class="finput" id="su-cls" placeholder="e.g. 10B"></div>
      </div>
      <div class="field"><label>Password</label><input type="password" id="su-pw" placeholder="At least 6 characters"></div>
      <div class="field"><label>Confirm Password</label><input type="password" id="su-pw2" placeholder="Re-enter password"></div>
      <div class="login-err" id="signup-err" style="display:none"></div>
      <div class="modal-footer">
        <button class="btn btn-crimson" onclick="doSignup()">Create Account</button>
        <button class="btn btn-ghost" onclick="document.getElementById('signup-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
        document.getElementById("su-name").focus();
      }

      async function doSignup() {
        const name = document.getElementById("su-name").value.trim();
        const email = document
          .getElementById("su-email")
          .value.trim()
          .toLowerCase();
        const form = document.getElementById("su-form").value;
        const cls = document.getElementById("su-cls").value.trim();
        const pw = document.getElementById("su-pw").value;
        const pw2 = document.getElementById("su-pw2").value;
        const err = document.getElementById("signup-err");
        const showErr = (msg) => {
          err.textContent = "⚠️ " + msg;
          err.style.display = "block";
        };

        if (!name || !email || !cls || !pw || !pw2) {
          showErr("Please fill in all fields.");
          return;
        }
        if (!isValidName(name)) {
          showErr("Name may only contain letters, spaces, hyphens, and apostrophes — no numbers or symbols.");
          return;
        }
        if (!isValidEmail(email)) {
          showErr("Please enter a valid email address.");
          return;
        }
        if (pw.length < 6) {
          showErr("Password must be at least 6 characters.");
          return;
        }
        if (findBlacklistedWord(pw)) {
          showErr("Password may not contain Blacklisted words.");
          return;
        }
        if (pw !== pw2) {
          showErr("Passwords do not match.");
          return;
        }

        // Account creation itself now happens entirely server-side (see
        // POST /api/auth/signup in server.js): the browser never reads or
        // writes the full users list to do this anymore, and the password
        // is hashed before it ever touches the database — this used to be
        // stored in plaintext client-side until first login.
        const submitBtn = document.querySelector('#signup-modal .btn-crimson');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Creating…"; }
        try {
          const resp = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, form, cls, password: pw }),
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            showErr(data.error || "Could not create account — please try again.");
            return;
          }

          document.getElementById("signup-modal").remove();
          document.getElementById("tab-student").click();
          document.getElementById("em").value = email;
          document.getElementById("pw").value = "";
          document.getElementById("pw").focus();
          showToast(
            `Welcome, ${name}! Your account was created ✓ Sign in to continue.`,
          );
        } catch (e) {
          showErr("Network error — could not reach server.");
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Create Account"; }
        }
      }

      // ─── SHELL ───────────────────────────────────────────
      const NAV = {
        student: [
          { id: "dashboard", label: "Dashboard", key: "dashboard" },
          { id: "forums", label: "Forums", key: "forums" },
          { id: "grades", label: "My Grades", key: "navMyGrades" },
          { id: "portal", label: "Classes", key: "classes" },
          { id: "homeroom", label: "HomeRoom", key: "homeroom" },
        ],
        teacher: [
          { id: "dashboard", label: "Dashboard", key: "dashboard" },
          { id: "portal", label: "My Portal", key: "navMyPortal" },
          { id: "grades", label: "Gradebook", key: "navGradebook" },
          { id: "classes", label: "Classes", key: "classes" },
          { id: "forums", label: "Forums", key: "forums" },
        ],
        parent: [
          { id: "dashboard", label: "Dashboard", key: "dashboard" },
          { id: "grades", label: "My Child's Grades", key: "navChildGrades" },
          { id: "portal", label: "Classes", key: "classes" },
          { id: "forums", label: "Forums", key: "forums" },
        ],
        admin: [
          { id: "dashboard", label: "Overview", key: "navOverview" },
          { id: "admin", label: "Staff", key: "navStaff" },
          { id: "accounts", label: "Accounts", key: "accounts" },
          { id: "grades", label: "Records", key: "navRecords" },
          { id: "classes", label: "Classes", key: "classes" },
          { id: "forums", label: "Forums", key: "forums" },
          { id: "aimonitor", label: "AI Monitor", key: "aiMonitor" },
          { id: "auditlog", label: "Audit Log", key: "auditLog" },
          { id: "syshealth", label: "System Health", key: "navSystemHealth" },
          { id: "backups", label: "Backups", key: "navBackups" },
          { id: "migrations", label: "Migrations", key: "navMigrations" },
        ],
      };

      function buildShell() {
        const pages = NAV[role];
        const u = currentUser;

        // ── Sidebar navigation ──────────────────────────────────────────
        const sbNavHTML = pages.map(p =>
          `<button class="sb-nav-btn" id="sb-${p.id}" onclick="navigateTo('${p.id}')">
            ${navIcon(p.id)}
            <span class="sb-nav-label">${t(p.key) || p.label}</span>
          </button>`
        ).join("");
        const sbNav = document.getElementById("sb-nav");
        if (sbNav) sbNav.innerHTML = sbNavHTML;

        // ── Topbar horizontal dropdown menu (mirrors sidebar pages) ──────
        const tbNavHTML = pages.map(p =>
          `<button class="tb-nav-item" id="tb-${p.id}" onclick="navigateTo('${p.id}'); closeTbNavDropdown();">
            ${navIcon(p.id)}
            <span>${t(p.key) || p.label}</span>
          </button>`
        ).join("");
        const tbNavPanel = document.getElementById("tb-nav-panel");
        if (tbNavPanel) tbNavPanel.innerHTML = tbNavHTML;
        const sbLangLabel = document.getElementById("sb-lang-label");
        if (sbLangLabel) sbLangLabel.textContent = t("changeLanguage");

        // ── Mobile bottom nav (≤768px) ──────────────────────────────────
        const MAX_VISIBLE_MOBILE = 4;
        const mobVisible = pages.slice(0, MAX_VISIBLE_MOBILE);
        const mobOverflow = pages.slice(MAX_VISIBLE_MOBILE);

        let mobNavHTML = "";
        if (mobOverflow.length > 0) {
          mobNavHTML += `<button class="mob-btn" id="mob-more-btn" onclick="toggleMobileNavMore(event)">
      ${navIcon("more")}<span>More</span>
    </button>`;
        }
        mobNavHTML += mobVisible.map(p =>
          `<button class="mob-btn" id="mob-${p.id}" onclick="navigateTo('${p.id}')">
      ${navIcon(p.id)}<span>${t(p.key) || p.label}</span>
    </button>`
        ).join("");
        const mobNav = document.getElementById("mob-nav");
        if (mobNav) mobNav.innerHTML = mobNavHTML;
        renderMobileNavMore(mobOverflow);
        const av = document.getElementById("uav");
        av.textContent = u.initials;
        av.className = `u-av ${u.av}`;
        document.getElementById("uname").textContent = u.name;
        const ur = document.getElementById("urole");
        const roleLabel =
          u.role === "student"
            ? `${u.form} · ${u.cls}`
            : u.role === "teacher"
              ? t("badgeTeacher")
              : u.role === "parent"
                ? t("badgeParent")
                : t("badgeAdmin");
        const roleClass =
          u.role === "student"
            ? "u-role-s"
            : u.role === "teacher"
              ? "u-role-t"
              : u.role === "parent"
                ? "u-role-p"
                : "u-role-a";
        ur.textContent = roleLabel;
        ur.className = `u-role ${roleClass}`;
      }

      // ── Sidebar toggle (desktop collapse / mobile drawer) ──
      let _sidebarCollapsed = false;
      function toggleSidebar() {
        const sb = document.getElementById("sidebar");
        const overlay = document.getElementById("sidebar-overlay");
        if (!sb) return;
        if (window.innerWidth <= 768) {
          // Mobile: slide-in drawer
          const isOpen = sb.classList.contains("mobile-open");
          if (isOpen) {
            sb.classList.remove("mobile-open");
            if (overlay) overlay.classList.remove("visible");
          } else {
            sb.classList.add("mobile-open");
            if (overlay) overlay.classList.add("visible");
          }
        } else {
          // Desktop: collapse/expand width
          _sidebarCollapsed = !_sidebarCollapsed;
          sb.classList.toggle("collapsed", _sidebarCollapsed);
        }
      }
      function closeSidebar() {
        const sb = document.getElementById("sidebar");
        const overlay = document.getElementById("sidebar-overlay");
        if (sb) sb.classList.remove("mobile-open");
        if (overlay) overlay.classList.remove("visible");
      }
      // ── Mobile "More" sheet (overflow pages on small screens) ──
      function renderMobileNavMore(items) {
        let backdrop = document.getElementById("mob-more-backdrop");
        if (!items || items.length === 0) {
          if (backdrop) backdrop.remove();
          return;
        }
        if (!backdrop) {
          backdrop = document.createElement("div");
          backdrop.id = "mob-more-backdrop";
          backdrop.className = "mob-more-backdrop";
          backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) closeMobileNavMore();
          });
          document.body.appendChild(backdrop);
        }
        backdrop.innerHTML = `
          <div class="mob-more-sheet" id="mob-more-sheet">
            <div class="mob-more-handle"></div>
            <div class="mob-more-title">More</div>
            <div class="mob-more-grid">
              ${items
                .map(
                  (p) =>
                    `<button class="mob-more-item" id="mobmore-${p.id}" onclick="navigateTo('${p.id}')">
                  ${navIcon(p.id)}<span>${t(p.key) || p.label}</span>
                </button>`,
                )
                .join("")}
            </div>
          </div>`;
      }
      function toggleMobileNavMore(e) {
        e.stopPropagation();
        const backdrop = document.getElementById("mob-more-backdrop");
        if (!backdrop) return;
        if (backdrop.classList.contains("open")) {
          closeMobileNavMore();
        } else {
          backdrop.classList.add("open");
          const moreBtn = document.getElementById("mob-more-btn");
          if (moreBtn) moreBtn.classList.add("active");
        }
      }
      function closeMobileNavMore() {
        const backdrop = document.getElementById("mob-more-backdrop");
        if (backdrop) backdrop.classList.remove("open");
      }

      function toggleTbNavDropdown(e) {
        if (e) e.stopPropagation();
        const dd = document.getElementById("tb-nav-dropdown");
        if (dd) dd.classList.toggle("open");
      }
      function closeTbNavDropdown() {
        const dd = document.getElementById("tb-nav-dropdown");
        if (dd) dd.classList.remove("open");
      }
      document.addEventListener("click", (e) => {
        const dd = document.getElementById("tb-nav-dropdown");
        if (dd && dd.classList.contains("open") && !dd.contains(e.target)) {
          dd.classList.remove("open");
        }
      });

      function navigateTo(pg, keepGradebookClass) {
        if (pg === "grades" && !keepGradebookClass) {
          currentGradebookClass = null;
          gradebookShowReportCards = false;
          studentGradesShowReportCard = false;
        }
        if (pg === "classes") currentHomeroomClass = null;
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        // Clear active state on all nav elements
        document.querySelectorAll(".sb-nav-btn, .tb-nav-item, .mob-btn, .mob-more-item").forEach(b => b.classList.remove("active"));

        const el = document.getElementById("page-" + pg);
        if (el) {
          el.innerHTML = renderPage(pg);
          el.classList.add("active");
        }
        // Activate sidebar button
        const sb = document.getElementById("sb-" + pg);
        if (sb) sb.classList.add("active");
        const tb = document.getElementById("tb-" + pg);
        if (tb) tb.classList.add("active");
        // Activate mobile button
        const mb = document.getElementById("mob-" + pg);
        if (mb) {
          mb.classList.add("active");
        } else {
          const moreItem = document.getElementById("mobmore-" + pg);
          if (moreItem) {
            moreItem.classList.add("active");
            const moreBtn = document.getElementById("mob-more-btn");
            if (moreBtn) moreBtn.classList.add("active");
          }
        }
        // Close mobile sidebar drawer if open
        closeSidebar();
        closeMobileNavMore();
        if (pg === "aimonitor") {
          startMonitorPolling();
        } else {
          stopMonitorPolling();
        }
        if (pg === "syshealth") startSysHealthPolling();
        else stopSysHealthPolling();
        // Translate user-entered content for current language
        if (currentLang !== "en") setTimeout(applyContentTranslations, 80);
      }

      function manageClass(classId) {
        currentGradebookClass = classId;
        navigateTo("grades", true);
      }

