      // ══════════════════════════════════════════════════════
      // ─── SELF PASSWORD RESET ──────────────────────────────
      // ══════════════════════════════════════════════════════
      function showSelfPasswordModal() {
        closeUserDropdown();
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "self-pwd-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-title">🔑 Reset Your Password</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <span class="ft-av ${currentUser.av}" style="width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--ink);flex-shrink:0">${currentUser.initials}</span>
        <div>
          <div style="font-weight:600;color:var(--navy)">${escapeHtml(currentUser.name)}</div>
          <div style="font-size:12px;color:var(--ink-35)">${currentUser.email}</div>
        </div>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label>Current Password</label>
        <input type="password" id="self-pwd-current" class="finput" placeholder="Enter your current password">
      </div>
      <div class="field" style="margin-bottom:12px">
        <label>New Password</label>
        <input type="password" id="self-pwd-new" class="finput" placeholder="Min 6 characters">
      </div>
      <div class="field" style="margin-bottom:12px">
        <label>Repeat New Password</label>
        <input type="password" id="self-pwd-repeat" class="finput" placeholder="Re-enter new password">
      </div>
      <div class="login-err" id="self-pwd-err" style="display:none"></div>
      <div class="modal-footer">
        <button class="btn btn-crimson" onclick="saveSelfPasswordChange()">Update Password</button>
        <button class="btn btn-ghost" onclick="document.getElementById('self-pwd-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
        document.getElementById("self-pwd-current").focus();
      }
      async function saveSelfPasswordChange() {
        const currentPw = document.getElementById("self-pwd-current").value;
        const newPw = document.getElementById("self-pwd-new").value;
        const repeatPw = document.getElementById("self-pwd-repeat").value;
        const err = document.getElementById("self-pwd-err");
        const showErr = (msg) => {
          err.textContent = "⚠️ " + msg;
          err.style.display = "block";
        };

        if (!currentPw || !newPw || !repeatPw) {
          showErr("Please fill in all password fields.");
          return;
        }

        const users = dbGetList("users");
        const u = users.find((x) => x.id === currentUser.id);
        if (!u) return;

        if (u.passwordHash) {
          // bcrypt check — requires server round-trip
          try {
            const vResp = await fetch("/api/auth/verify-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password: currentPw, hash: u.passwordHash })
            });
            if (vResp.ok) {
              const { ok } = await vResp.json();
              if (!ok) { showErr("Current password is incorrect."); return; }
            } else { showErr("Could not verify password — server error."); return; }
          } catch { showErr("Could not verify password — network error."); return; }
        } else if (u.password !== currentPw) {
          showErr("Current password is incorrect.");
          return;
        }
        if (newPw.length < 6) {
          showErr("New password must be at least 6 characters.");
          return;
        }
        if (findBlacklistedWord(newPw)) {
          showErr("Password may not contain Blacklisted words.");
          return;
        }
        if (newPw !== repeatPw) {
          showErr("New passwords do not match.");
          return;
        }

        // Hash via server bcrypt API
        try {
          const hashResp = await fetch("/api/auth/hash-password", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + _sessionToken },
            body: JSON.stringify({ password: newPw })
          });
          if (hashResp.ok) {
            const { hash } = await hashResp.json();
            u.passwordHash = hash;
            delete u.password;
          } else { u.password = newPw; }
        } catch { u.password = newPw; }
        dbSaveList("users", users);
        // Update currentUser in memory
        delete currentUser.password;
        currentUser.passwordHash = u.passwordHash || undefined;

        addAuditLogEntry("password_reset_self", currentUser.id, currentUser.name, `User changed their own password`);

        document.getElementById("self-pwd-modal").remove();
        showToast("Password updated successfully ✓");
      }

      // ══════════════════════════════════════════════════════
      // ─── AUDIT LOG ────────────────────────────────────────
      // ══════════════════════════════════════════════════════
      function addAuditLogEntry(action, targetId, targetName, details) {
        const entries = dbGetList("audit_log") || [];
        entries.unshift({
          id: dbGenId("audit"),
          timestamp: Date.now(),
          actorId: currentUser ? currentUser.id : "system",
          actorName: currentUser ? currentUser.name : "System",
          actorRole: currentUser ? currentUser.role : "system",
          action,
          targetId,
          targetName,
          details,
        });
        // Keep last 1000 entries
        if (entries.length > 1000) entries.length = 1000;
        dbSaveList("audit_log", entries);
      }

      function getAuditLogEntries(filterAction = "", searchQ = "") {
        let entries = dbGetList("audit_log") || [];
        if (filterAction) {
          entries = entries.filter((e) => e.action === filterAction);
        }
        if (searchQ) {
          const q = searchQ.toLowerCase();
          entries = entries.filter(
            (e) =>
              (e.actorName && e.actorName.toLowerCase().includes(q)) ||
              (e.targetName && e.targetName.toLowerCase().includes(q)) ||
              (e.details && e.details.toLowerCase().includes(q)) ||
              (e.action && e.action.toLowerCase().includes(q)),
          );
        }
        return entries;
      }

      function adminAuditLog() {
        if (!currentUser || currentUser.role !== "admin") return accessDenied();
        const entries = getAuditLogEntries(auditFilterAction, auditSearchQ);
        const actionLabels = {
          account_created: "🆕 Created",
          account_edited: "✏️ Edited",
          account_deleted: "🗑️ Deleted",
          account_suspended: "🔴 Suspended",
          account_unsuspended: "✅ Unsuspended",
          force_logout: "⏏ Force Logout",
          password_changed: "🔑 Password Changed",
          password_reset_self: "🔒 Self Password Reset",
          blacklist_blocked: "🚫 Blacklist Blocked",
          blacklist_auto_removed: "🚫 Blacklist Auto-Removed",
          blacklist_word_added: "🚫 Blacklist Word Added",
          blacklist_word_removed: "🚫 Blacklist Word Removed",
          ai_security_lockdown: "🚨 AI Shut Down (Security)",
          ai_security_lockdown_cleared: "✅ AI Re-enabled",
          ai_dangerous_content: "🚨 AI Shut Down (Dangerous Content)",
          ai_web_search_toggled: "🔧 Web Search Toggled",
          ai_web_search: "🌐 AI Web Search",
          ai_model_switched: "🔁 AI Model Switched",
          ai_model_auto_switched: "🤖 AI Auto-Switched Model",
        };
        const actionColors = {
          account_created: "#3a7a5c",
          account_edited: "var(--gold)",
          account_deleted: "var(--crimson)",
          account_suspended: "#dc3545",
          account_unsuspended: "#3a7a5c",
          force_logout: "#e07b00",
          password_changed: "var(--navy-mid)",
          password_reset_self: "#7a4080",
          blacklist_blocked: "var(--crimson)",
          blacklist_auto_removed: "var(--crimson)",
          blacklist_word_added: "var(--gold)",
          blacklist_word_removed: "var(--ink-35)",
          ai_security_lockdown: "var(--crimson)",
          ai_security_lockdown_cleared: "#3a7a5c",
          ai_dangerous_content: "var(--crimson)",
          ai_web_search_toggled: "var(--navy-mid)",
          ai_web_search: "var(--navy-mid)",
          ai_model_switched: "var(--navy-mid)",
          ai_model_auto_switched: "var(--gold)",
        };
        const rows = entries.length
          ? entries
              .map(
                (e) => `
      <tr>
        <td style="font-size:12px;color:var(--ink-35);white-space:nowrap">${timeAgo(e.timestamp)}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:600;background:${actionColors[e.action] || "var(--ink-12)"};color:#fff">
            ${actionLabels[e.action] || e.action}
          </span>
        </td>
        <td style="font-size:13px;font-weight:500">${escapeHtml(e.targetName) || "—"}</td>
        <td style="font-size:12px;color:var(--ink-60)">${escapeHtml(e.details) || "—"}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="ft-av ${(dbGetList("users").find((u) => u.id === e.actorId) || {}).av || "av1"}" style="width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--ink);flex-shrink:0">${(dbGetList("users").find((u) => u.id === e.actorId) || {}).initials || "?"}</span>
            <span style="font-size:12px">${escapeHtml(e.actorName)}</span>
          </div>
        </td>
      </tr>`,
              )
              .join("")
          : `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--ink-35)">No audit log entries yet.<br>Actions on accounts will be recorded here automatically.</td></tr>`;

        return `<div class="inner">
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2>Audit <em>Log</em></h2><p>Record of all account changes · ${entries.length} entries</p></div>
    </div>
    <div class="card">
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <select class="fselect" style="width:auto;min-width:140px" onchange="auditFilterAction=this.value;renderAuditLogPage()">
          <option value="">All Actions</option>
          <option value="account_created" ${auditFilterAction === "account_created" ? "selected" : ""}>🆕 Created</option>
          <option value="account_edited" ${auditFilterAction === "account_edited" ? "selected" : ""}>✏️ Edited</option>
          <option value="account_deleted" ${auditFilterAction === "account_deleted" ? "selected" : ""}>🗑️ Deleted</option>
          <option value="account_suspended" ${auditFilterAction === "account_suspended" ? "selected" : ""}>🔴 Suspended</option>
          <option value="account_unsuspended" ${auditFilterAction === "account_unsuspended" ? "selected" : ""}>✅ Unsuspended</option>
          <option value="force_logout" ${auditFilterAction === "force_logout" ? "selected" : ""}>⏏ Force Logout</option>
          <option value="password_changed" ${auditFilterAction === "password_changed" ? "selected" : ""}>🔑 Password Changed</option>
          <option value="password_reset_self" ${auditFilterAction === "password_reset_self" ? "selected" : ""}>🔒 Self Password Reset</option>
          <option value="blacklist_blocked" ${auditFilterAction === "blacklist_blocked" ? "selected" : ""}>🚫 Blacklist Blocked</option>
          <option value="blacklist_auto_removed" ${auditFilterAction === "blacklist_auto_removed" ? "selected" : ""}>🚫 Blacklist Auto-Removed</option>
          <option value="blacklist_word_added" ${auditFilterAction === "blacklist_word_added" ? "selected" : ""}>🚫 Blacklist Word Added</option>
          <option value="blacklist_word_removed" ${auditFilterAction === "blacklist_word_removed" ? "selected" : ""}>🚫 Blacklist Word Removed</option>
          <option value="ai_dangerous_content" ${auditFilterAction === "ai_dangerous_content" ? "selected" : ""}>🚨 AI Dangerous Content</option>
          <option value="ai_security_lockdown" ${auditFilterAction === "ai_security_lockdown" ? "selected" : ""}>🚨 AI Shut Down (Security)</option>
          <option value="ai_security_lockdown_cleared" ${auditFilterAction === "ai_security_lockdown_cleared" ? "selected" : ""}>✅ AI Re-enabled</option>
          <option value="ai_web_search_toggled" ${auditFilterAction === "ai_web_search_toggled" ? "selected" : ""}>🔧 Web Search Toggled</option>
          <option value="ai_web_search" ${auditFilterAction === "ai_web_search" ? "selected" : ""}>🌐 AI Web Search</option>
          <option value="ai_model_switched" ${auditFilterAction === "ai_model_switched" ? "selected" : ""}>🔁 AI Model Switched</option>
          <option value="ai_model_auto_switched" ${auditFilterAction === "ai_model_auto_switched" ? "selected" : ""}>🤖 AI Auto-Switched Model</option>
        </select>
        <div class="search-bar" style="flex:1;max-width:320px;margin-bottom:0">
          <span>🔍</span>
          <input placeholder="Search by actor, target, or detail…" oninput="auditSearchQ=this.value;renderAuditLogPage()" value="${auditSearchQ}">
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="tt">
          <thead><tr><th>When</th><th>Action</th><th>Target</th><th>Details</th><th>Actor</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
      }

      function renderAuditLogPage() {
        const el = document.getElementById("page-auditlog");
        if (el) {
          el.innerHTML = adminAuditLog();
        }
      }

      let auditFilterAction = "";
      let auditSearchQ = "";

      function renderGradebookPage() {
        const el = document.getElementById("page-grades");
        if (el) el.innerHTML = renderPage("grades");
      }

      function renderPage(pg) {
        if (pg === "dashboard") {
          if (role === "student") return studentDash();
          if (role === "teacher") return teacherDash();
          if (role === "parent") return parentDash();
          return adminDash();
        }
        if (pg === "portal")
          return role === "student"
            ? studentClasses()
            : role === "parent"
              ? parentClasses()
              : teacherPortal();
        if (pg === "grades")
          return role === "student"
            ? studentGradesPage()
            : role === "parent"
              ? parentGrades()
              : role === "admin"
                ? adminRecords()
                : gradebook();
        if (pg === "forums") return forums();
        if (pg === "admin")
          return role === "admin" ? adminStaff() : accessDenied();
        if (pg === "accounts")
          return role === "admin" ? adminAccounts() : accessDenied();
        if (pg === "aimonitor")
          return role === "admin" ? adminAIMonitor() : accessDenied();
        if (pg === "auditlog")
          return role === "admin" ? adminAuditLog() : accessDenied();
        if (pg === "syshealth")
          return role === "admin" ? adminSysHealth() : accessDenied();
        if (pg === "backups")
          return role === "admin" ? adminBackups() : accessDenied();
        if (pg === "migrations")
          return role === "admin" ? adminMigrations() : accessDenied();
        if (pg === "classes")
          return role === "teacher" || role === "admin"
            ? currentHomeroomClass
              ? homeroomRosterView(currentHomeroomClass)
              : classDirectory()
            : accessDenied();
        if (pg === "homeroom")
          return role === "student" ? studentHomeRoom() : accessDenied();
        return "";
      }

      // ══════════════════════════════════════════════════════
      // ─── ANNOUNCEMENTS (DB-backed) ────────────────────────
      // ══════════════════════════════════════════════════════
      // Announcements can optionally carry a `classId` (a homeroom id, e.g.
      // "10BA"). School-wide announcements have no classId and show up on
      // the general dashboards. Class announcements only show wherever a
      // matching classId filter is passed in (the homeroom roster view for
      // staff, and the student's HomeRoom tab).
      function renderAnnouncements(limit = 3, showControls = false, classId = null) {
        let anns = dbGetList("announcements");
        anns = classId
          ? anns.filter((a) => a.classId === classId)
          : anns.filter((a) => !a.classId);
        anns = anns.slice(0, limit);
        const colorMap = { crimson: "", navy: "ann-nv", gold: "ann-gd" };
        return anns
          .map(
            (a) => `
    <div class="ann ${colorMap[a.color] || ""}" id="ann-${a.id}">
      <div class="ann-title">${escapeHtml(a.title)}${a.pinned ? " 📌" : ""}</div>
      <div class="ann-body"><span class="translatable-content">${escapeHtml(a.body)}</span></div>
      <div class="ann-date">${a.author} · ${timeAgo(a.date)}</div>
      ${
        showControls
          ? `<div class="ann-actions">
        <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="deleteAnnouncement('${a.id}')">🗑 Delete</button>
      </div>`
          : ""
      }
    </div>`,
          )
          .join("");
      }

      function deleteAnnouncement(id) {
        const anns = dbGetList("announcements");
        const target = anns.find((a) => a.id === id);
        const filtered = anns.filter((a) => a.id !== id);
        dbSaveList("announcements", filtered);
        if (target && target.classId && currentHomeroomClass) {
          renderClassesPage();
        } else {
          navigateTo("dashboard");
        }
        showToast("Announcement deleted");
      }

      // classId: pass a homeroom id to post a class-specific announcement
      // (used from the homeroom roster view). Omit for a school-wide one.
      function showAddAnnouncement(classId) {
        const cls = classId ? dbGetList("homerooms").find((h) => h.id === classId) : null;
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "ann-modal";
        backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-title">📢 New ${cls ? cls.label + " Homeroom " : ""}Announcement</div>
      ${cls ? `<input type="hidden" id="ann-classid" value="${cls.id}">` : ""}
      <div class="ffield" style="margin-bottom:12px"><div class="flabel">Title</div><input class="finput" id="ann-t" placeholder="Announcement title"></div>
      <div class="ffield" style="margin-bottom:12px"><div class="flabel">Body</div><textarea class="ftextarea" id="ann-b" placeholder="Details…"></textarea></div>
      <div class="frow">
        <div class="ffield"><div class="flabel">Author</div><input class="finput" id="ann-a" placeholder="e.g. Principal's Office" value="${escapeHtml(currentUser.name)}"></div>
        <div class="ffield"><div class="flabel">Colour</div>
          <select class="fselect" id="ann-c"><option value="crimson">🔴 Crimson</option><option value="navy">🔵 Navy</option><option value="gold">🟡 Gold</option></select>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <input type="checkbox" id="ann-pin" style="width:auto">
        <label for="ann-pin" style="font-size:13px;cursor:pointer">Pin this announcement</label>
      </div>
      ${cls ? `<p style="font-size:11px;color:var(--ink-35);margin-top:10px">This will only be visible to students in ${escapeHtml(cls.label)}.</p>` : ""}
      <div class="modal-footer">
        <button class="btn btn-crimson" onclick="saveAnnouncement()">Post</button>
        <button class="btn btn-ghost" onclick="document.getElementById('ann-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
      }

      function saveAnnouncement() {
        const t = document.getElementById("ann-t").value.trim();
        const b = document.getElementById("ann-b").value.trim();
        const a = document.getElementById("ann-a").value.trim();
        const c = document.getElementById("ann-c").value;
        const pin = document.getElementById("ann-pin").checked;
        const classIdField = document.getElementById("ann-classid");
        const classId = classIdField ? classIdField.value : null;
        if (!t || !b) {
          showToast("Please fill in title and body", "err");
          return;
        }
        const blAnnT = findBlacklistedWord(t);
        const blAnnB = findBlacklistedWord(b);
        if (blAnnT || blAnnB) {
          showToast(`Cannot post — content contains a blacklisted word ("${blAnnT || blAnnB}")`, "err");
          recordBlacklistBlock(blAnnT || blAnnB, "announcement_blocked", blAnnT ? t : b, t);
          return;
        }
        const anns = dbGetList("announcements");
        anns.unshift({
          id: dbGenId("a"),
          title: t,
          body: b,
          author: a || currentUser.name,
          color: c,
          date: Date.now(),
          pinned: pin,
          classId: classId || null,
        });
        dbSaveList("announcements", anns);
        document.getElementById("ann-modal").remove();
        if (classId && currentHomeroomClass) {
          renderClassesPage();
        } else {
          navigateTo("dashboard");
        }
        showToast(
          classId ? "Class announcement posted ✓" : "Announcement posted ✓",
          "ok",
        );
      }

      // ══════════════════════════════════════════════════════
      // ─── DASHBOARDS ───────────────────────────────────────
      // ══════════════════════════════════════════════════════
      function studentDash() {
        const grades = dbGetList("grades_" + currentUser.id);
        const avg = grades.length
          ? Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length)
          : 0;
        const gradeLabel =
          avg >= 90
            ? "A"
            : avg >= 80
              ? "B+"
              : avg >= 70
                ? "B"
                : avg >= 60
                  ? "C+"
                  : "C";
        const assignments = dbGetList("assignments");
        return `<div class="inner">
    <div class="ph">
      <h2>Sawubona, <em>${escapeHtml(currentUser.name)}</em> 👋</h2>
      <p>Wednesday, 11 June · ${currentUser.form} · Class ${currentUser.cls} · [School Name]</p>
    </div>
    <div class="g4" style="margin-bottom:22px">
      <div class="stat cr"><div class="stat-icon">⭐</div><div class="stat-num">${gradeLabel}</div><div class="stat-label">Term Average</div></div>
      <div class="stat nv"><div class="stat-icon">⏰</div><div class="stat-num">${assignments.length}</div><div class="stat-label">Active Assignments</div></div>
      <div class="stat gd"><div class="stat-icon">🏆</div><div class="stat-num">—</div><div class="stat-label">Class Rank</div></div>
      <div class="stat gr"><div class="stat-icon">💬</div><div class="stat-num">${dbGetList("forum_threads").filter((t) => t.authorId === "u1").length}</div><div class="stat-label">My Forum Posts</div></div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-title">📚 My Subjects</div>
        ${grades
          .slice(0, 3)
          .map(
            (g) => `
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;gap:8px">
              <div>
                <div style="font-size:14px;font-weight:500;color:var(--ink)">${escapeHtml(g.subject)}</div>
                <div style="font-size:11px;color:var(--ink-35)">${g.teacher}</div>
              </div>
              <span style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;color:var(--navy)">${g.grade}</span>
            </div>
            <div class="pbar"><div class="pfill" style="width:${g.score}%;background:${g.color}"></div></div>
          </div>`,
          )
          .join("")}
        <button class="btn btn-ghost" style="width:100%;margin-top:4px;font-size:12px" onclick="navigateTo('grades')">View all grades →</button>
      </div>
      <div class="card">
        <div class="card-title">📣 School Notices</div>
        ${renderAnnouncements(3)}
      </div>
    </div>
  </div>`;
      }

      function teacherDash() {
        const assignments = dbGetList("assignments").filter(
          (a) => a.teacherId === currentUser.id,
        );
        const gb = dbGetList("gradebook_10B");
        const allScores = gb.flatMap((s) => s.scores);
        const classAvg = allScores.length
          ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
          : 0;
        const threads = dbGetList("forum_threads");
        return `<div class="inner">
    <div class="ph">
      <h2>Good morning,<br><em>${escapeHtml(currentUser.name)}</em> 👋</h2>
      <p>Wednesday, 11 June · Term 2 Week 8 · [School Name]</p>
    </div>
    <div class="g4" style="margin-bottom:22px">
      <div class="stat cr"><div class="stat-icon">👩‍🎓</div><div class="stat-num">${gb.length * 6}</div><div class="stat-label">My Students</div></div>
      <div class="stat nv"><div class="stat-icon">📝</div><div class="stat-num">${assignments.length}</div><div class="stat-label">Active Assignments</div></div>
      <div class="stat gd"><div class="stat-icon">💬</div><div class="stat-num">${threads.length}</div><div class="stat-label">Forum Threads</div></div>
      <div class="stat gr"><div class="stat-icon">📈</div><div class="stat-num">${classAvg}%</div><div class="stat-label">Class Average</div></div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          📢 School Announcements
          <button class="btn btn-crimson" style="font-size:11px;padding:6px 12px" onclick="showAddAnnouncement()">+ Post</button>
        </div>
        ${renderAnnouncements(3, true)}
      </div>
      <div class="card">
        <div class="card-title">📅 Active Assignments</div>
        ${assignments
          .slice(0, 4)
          .map(
            (a) => `
          <div class="list-item">
            <div class="li-dot dc"></div>
            <div class="li-main">
              <div class="li-title">${escapeHtml(a.title)}</div>
              <div class="li-sub">${a.cls} · Due ${a.due}</div>
              <div style="margin-top:5px;display:flex;align-items:center;gap:8px">
                <div class="pbar" style="width:100px"><div class="pfill" style="width:${Math.round((a.submitted / a.total) * 100)}%;background:var(--crimson)"></div></div>
                <span style="font-size:11px;color:var(--ink-35)">${a.submitted}/${a.total}</span>
              </div>
            </div>
            <div class="li-aside">${a.due}</div>
          </div>`,
          )
          .join("")}
      </div>
    </div>
  </div>`;
      }

      function parentDash() {
        const child = dbGetList("users").find(
          (u) => u.id === currentUser.childId,
        );
        const childName = child
          ? child.name
          : currentUser.childName || "your child";
        const childForm = child ? child.form : "";
        const childCls = child ? child.cls : "";
        return `<div class="inner">
    <div class="ph">
      <h2>Welcome, <em>${escapeHtml(currentUser.name)}</em></h2>
      <p>Parent of ${childName}${childForm ? " · " + childForm : ""}${childCls ? " · Class " + childCls : ""} · [School Name]</p>
    </div>
    <div class="g3" style="margin-bottom:22px">
      <div class="stat cr"><div class="stat-icon">📊</div><div class="stat-num">View</div><div class="stat-label">Grades & Reports</div></div>
      <div class="stat nv"><div class="stat-icon">📅</div><div class="stat-num">View</div><div class="stat-label">Classes & Assignments</div></div>
      <div class="stat gd"><div class="stat-icon">💬</div><div class="stat-num">View</div><div class="stat-label">School Forums</div></div>
    </div>
    <div class="card">
      <div class="card-title">👨‍👩‍👧 Parent Portal</div>
      <p style="font-size:14px;color:var(--ink-60);line-height:1.6">
        Use the navigation above to view your child's academic progress, grades, and school announcements.
        All marks are updated in real-time as teachers enter them.
      </p>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-crimson" onclick="navigateTo('grades')">📊 View Grades</button>
        <button class="btn btn-navy" onclick="navigateTo('portal')">📅 View Classes</button>
        <button class="btn btn-ghost" onclick="navigateTo('forums')">💬 Forums</button>
      </div>
    </div>
  </div>`;
      }

      function adminDash() {
        const staff = dbGetList("staff");
        const anns = dbGetList("announcements").filter((a) => !a.classId);
        const totalStudents = dbGetList("users").filter(
          (u) => u.role === "student",
        ).length;
        const activeClasses = dbGetList("homerooms").length;
        const gbClasses = dbGetList("gb_classes");
        const allScores = gbClasses.flatMap((c) =>
          dbGetList("gradebook_" + c.id).flatMap((s) => s.scores || []),
        );
        const passRate = allScores.length
          ? Math.round(
              (allScores.filter((s) => s >= 50).length / allScores.length) *
                100,
            ) + "%"
          : "—";
        return `<div class="inner">
    <div class="ph">
      <h2>School <em>Overview</em></h2>
      <p>[School Name] · Wednesday, 11 June 2026</p>
    </div>
    <div class="g4" style="margin-bottom:22px">
      <div class="stat cr"><div class="stat-icon">👩‍🎓</div><div class="stat-num">${totalStudents}</div><div class="stat-label">Total Students</div></div>
      <div class="stat nv"><div class="stat-icon">👨‍🏫</div><div class="stat-num">${staff.length}</div><div class="stat-label">Teaching Staff</div></div>
      <div class="stat gd"><div class="stat-icon">🏫</div><div class="stat-num">${activeClasses}</div><div class="stat-label">Active Classes</div></div>
      <div class="stat gr"><div class="stat-icon">📊</div><div class="stat-num">${passRate}</div><div class="stat-label">Pass Rate</div></div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          📢 Announcements (${anns.length})
          <button class="btn btn-crimson" style="font-size:11px;padding:6px 12px" onclick="showAddAnnouncement()">+ Post</button>
        </div>
        ${renderAnnouncements(4, true)}
      </div>
      <div class="card">
        <div class="card-title">📊 Staff Summary</div>
        ${[
          {
            label: "Active",
            val: staff.filter((t) => t.status === "active").length,
            c: "#3A7A5C",
            total: staff.length,
          },
          {
            label: "On Leave",
            val: staff.filter((t) => t.status === "leave").length,
            c: "var(--gold)",
            total: staff.length,
          },
          {
            label: "Substitute",
            val: staff.filter((t) => t.status === "sub").length,
            c: "var(--navy-mid)",
            total: staff.length,
          },
        ]
          .map(
            (s) => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:13px;color:var(--ink)">${s.label}</span>
              <span style="font-size:13px;font-weight:600;color:var(--ink)">${s.val} / ${s.total}</span>
            </div>
            <div class="pbar"><div class="pfill" style="width:${Math.round((s.val / s.total) * 100)}%;background:${s.c}"></div></div>
          </div>`,
          )
          .join("")}
        <hr class="divider">
        ${[
          { label: "Maths Pass Rate", val: 68, c: "var(--crimson)" },
          { label: "English Pass Rate", val: 79, c: "var(--navy-mid)" },
          { label: "Sciences Pass Rate", val: 72, c: "#3A7A5C" },
        ]
          .map(
            (s) => `
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:13px;color:var(--ink)">${s.label}</span>
              <span style="font-size:13px;font-weight:600;color:var(--ink)">${s.val}%</span>
            </div>
            <div class="pbar"><div class="pfill" style="width:${s.val}%;background:${s.c}"></div></div>
          </div>`,
          )
          .join("")}
      </div>
    </div>
  </div>`;
      }

      // ══════════════════════════════════════════════════════
      // ─── STUDENT PAGES ────────────────────────────────────
      // ══════════════════════════════════════════════════════
      function studentGradesPage() {
        return studentGradesShowReportCard
          ? studentReportCard()
          : studentGrades();
      }

      function showStudentReportCard() {
        studentGradesShowReportCard = true;
        renderGradebookPage();
      }

      function hideStudentReportCard() {
        studentGradesShowReportCard = false;
        renderGradebookPage();
      }

      function studentGrades() {
        const grades = dbGetList("grades_" + currentUser.id);
        return `<div class="inner">
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2>My <em>Grades</em></h2><p>${escapeHtml(currentUser.form)} · ${escapeHtml(currentUser.cls)} · Term 2 · 2026 — ${escapeHtml(currentUser.name)} · Latest assignment result per subject</p></div>
      <button class="icon-btn" onclick="showStudentReportCard()" title="Report Card — overall average" aria-label="Report Card">⋯</button>
    </div>
    <div class="g2">
      ${grades
        .map(
          (c, i) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
            <div>
              <div style="font-family:\'Playfair Display\',serif;font-size:16px;font-weight:700;color:var(--navy)">${escapeHtml(c.subject)}</div>
              <div style="font-size:12px;color:var(--ink-35);margin-top:3px">${c.teacher}</div>
            </div>
            <div style="font-family:\'Playfair Display\',serif;font-size:30px;font-weight:900;color:var(--navy)">${c.grade}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <span class="source-badge source-gb" style="font-size:10px">📝 Latest: ${escapeHtml(c.assignment || "Most recent assignment")}</span>
            ${c.date ? `<span style="font-size:11px;color:var(--ink-35)">${c.date}</span>` : ""}
          </div>
          <div class="pbar"><div class="pfill" style="width:${c.score}%;background:${c.color}"></div></div>
          <div style="font-size:12px;color:var(--ink-35);margin-top:6px">${c.score} / 100</div>
        </div>`,
        )
        .join("")}
    </div>
    <div class="card" style="margin-top:20px;text-align:center;padding:18px 20px">
      <div style="font-size:12px;color:var(--ink-60)">Want your overall standing for the term instead?</div>
      <button class="btn btn-crimson" style="margin-top:10px" onclick="showStudentReportCard()">📊 View Report Card (Overall Average)</button>
    </div>
  </div>`;
      }

      // ─── STUDENT CLASS CARDS (also used by class-detail modal) ───
      const STUDENT_SUBJECTS = [
        {
          sub: "English Literature",
          t: "Mr. M. Dlamini",
          rm: "Room 12",
          emoji: "📖",
          c: "var(--crimson)",
          next: "Today 07:30",
        },
        {
          sub: "Mathematics",
          t: "Ms. Maphanga",
          rm: "Room 7",
          emoji: "📐",
          c: "var(--navy-mid)",
          next: "Today 09:10",
        },
        {
          sub: "Biology",
          t: "Dr. B. Mkhonta",
          rm: "Lab A",
          emoji: "🧬",
          c: "#3A7A5C",
          next: "Today 11:00",
        },
        {
          sub: "History",
          t: "Mr. T. Vilakati",
          rm: "Room 15",
          emoji: "🗺️",
          c: "var(--gold)",
          next: "Thu 13:30",
        },
        {
          sub: "Chemistry",
          t: "Ms. F. Fakudze",
          rm: "Lab B",
          emoji: "⚗️",
          c: "#7A4080",
          next: "Fri 09:10",
        },
        {
          sub: "Physics",
          t: "Ms. Maphanga",
          rm: "Lab B",
          emoji: "⚛️",
          c: "var(--crimson)",
          next: "Fri 11:00",
        },
      ];

      function studentClasses() {
        return `<div class="inner">
    <div class="ph"><h2>My <em>Classes</em></h2><p>${escapeHtml(currentUser.form)} · ${escapeHtml(currentUser.cls)} · Term 2, 2026 — ${escapeHtml(currentUser.name)}</p></div>
    <div class="g3">
      ${STUDENT_SUBJECTS.map(
        (c, i) => `
        <div class="class-card" style="cursor:pointer" onclick="openClassDetail(${i})">
          <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${c.c}"></div>
          <div style="font-size:28px;margin-bottom:10px">${c.emoji}</div>
          <div style="font-family:\'Playfair Display\',serif;font-size:15px;font-weight:700;color:var(--navy)">${c.sub}</div>
          <div style="font-size:12px;color:var(--ink-35);margin-top:4px">${c.t}</div>
          <div style="font-size:12px;color:var(--ink-35);margin-top:2px">${c.rm}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
            <div style="width:6px;height:6px;border-radius:50%;background:${c.c}"></div>
            <span style="font-size:12px;color:var(--ink-60)">Next: ${c.next}</span>
          </div>
          <button class="btn btn-ghost" style="margin-top:14px;width:100%;font-size:12px">View Class →</button>
        </div>`,
      ).join("")}
    </div>
  </div>`;
      }

      // ─── PARENT CLASSES (read-only view of the child's classes) ───
      function parentClasses() {
        const child = dbGetList("users").find(
          (u) => u.id === currentUser.childId,
        );
        const childName = child
          ? child.name
          : currentUser.childName || "your child";
        const childForm = child ? child.form : "";
        const childCls = child ? child.cls : "";
        return `<div class="inner">
    <div class="ph"><h2>${escapeHtml(childName)}'s <em>Classes</em></h2><p>${childForm}${childForm && childCls ? " · " : ""}${childCls} · Term 2, 2026 · Parent View</p></div>
    <div class="g3">
      ${STUDENT_SUBJECTS.map(
        (c, i) => `
        <div class="class-card" style="cursor:pointer" onclick="openParentClassDetail(${i})">
          <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${c.c}"></div>
          <div style="font-size:28px;margin-bottom:10px">${c.emoji}</div>
          <div style="font-family:\'Playfair Display\',serif;font-size:15px;font-weight:700;color:var(--navy)">${c.sub}</div>
          <div style="font-size:12px;color:var(--ink-35);margin-top:4px">${c.t}</div>
          <div style="font-size:12px;color:var(--ink-35);margin-top:2px">${c.rm}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
            <div style="width:6px;height:6px;border-radius:50%;background:${c.c}"></div>
            <span style="font-size:12px;color:var(--ink-60)">Next: ${c.next}</span>
          </div>
          <button class="btn btn-ghost" style="margin-top:14px;width:100%;font-size:12px">View Class →</button>
        </div>`,
      ).join("")}
    </div>
  </div>`;
      }

      function openParentClassDetail(idx) {
        const c = STUDENT_SUBJECTS[idx];
        if (!c) return;
        const child = dbGetList("users").find(
          (u) => u.id === currentUser.childId,
        );
        const childId = child ? child.id : currentUser.childId || "u1";
        const childForm = child ? child.form : "";
        const childCls = child ? child.cls : "";
        const clsLabel = `${childForm} · ${childCls}`;
        const notes = classNotesFor(c.sub);
        const assignments = dbGetList("assignments")
          .filter(
            (a) =>
              a.cls === clsLabel && subjectKey(a.subject) === subjectKey(c.sub),
          )
          .sort((a, b) => new Date(a.due) - new Date(b.due));
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "class-detail-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:620px;max-height:85vh;overflow-y:auto">
      <div class="modal-title">${c.emoji} ${escapeHtml(c.sub)}</div>
      <p style="font-size:12px;color:var(--ink-35);margin-top:-14px;margin-bottom:18px">${escapeHtml(c.t)} · ${escapeHtml(c.rm)}</p>

      <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-60);margin-bottom:10px">📝 Latest Notes</div>
      ${
        notes.length
          ? notes
              .map(
                (n) => `
        <div class="list-item">
          <div class="li-dot dn"></div>
          <div class="li-main">
            <div class="li-title">${escapeHtml(n.title)}</div>
            <div style="font-size:13px;color:var(--ink-60);margin-top:4px;line-height:1.5">${escapeHtml(n.body)}</div>
            <div class="li-sub" style="margin-top:6px">${escapeHtml(n.author)} · ${timeAgo(n.time)}</div>
          </div>
        </div>`,
              )
              .join("")
          : `<p style="font-size:13px;color:var(--ink-35)">No notes posted for this class yet.</p>`
      }

      <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-60);margin:20px 0 10px">📚 Assignments</div>
      ${
        assignments.length
          ? assignments
              .map((a) => {
                const sub = dbGetList("submissions").find(
                  (s) => s.assignmentId === a.id && s.studentId === childId,
                );
                const max = a.marks || 100;
                let statusHtml;
                if (sub && sub.status === "graded") {
                  statusHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:rgba(58,122,92,.12);color:#3A7A5C">Graded · ${sub.grade}/${max}</span>`;
                } else if (sub) {
                  statusHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:var(--gold-pale);color:var(--gold)">Submitted</span>`;
                } else {
                  statusHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:var(--crimson-pale);color:var(--crimson)">Not submitted</span>`;
                }
                return `
        <div class="arow" style="align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="font-size:14px;font-weight:500;color:var(--ink)">${escapeHtml(a.title)}</div>
              ${statusHtml}
            </div>
            <div style="font-size:12px;color:var(--ink-35);margin-top:4px">Due ${a.due}</div>
            ${
              sub && sub.status === "graded" && sub.feedback
                ? `<div style="font-size:12px;color:var(--ink-60);margin-top:6px;font-style:italic">“${escapeHtml(sub.feedback)}”</div>`
                : ""
            }
          </div>
        </div>`;
              })
              .join("")
          : `<p style="font-size:13px;color:var(--ink-35)">No assignments for this class right now.</p>`
      }

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('class-detail-modal').remove()">Close</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
      }

      // ─── HOMEROOM (student) — announcements + tasks hub ───
      // Finds the homeroom (registration class) a student actually belongs
      // to, by looking for their userId in each homeroom's roster — this is
      // the same link staff use when managing rosters, and is independent
      // of the student's gradebook/subject class (currentUser.cls).
      function findStudentHomeroom(studentId) {
        const homerooms = dbGetList("homerooms");
        for (const h of homerooms) {
          const roster = dbGetList("homeroom_" + h.id);
          if (roster.some((s) => s.userId === studentId)) return h;
        }
        return null;
      }

      function studentHomeRoom() {
        const homeroom = findStudentHomeroom(currentUser.id);
        const homeroomId = homeroom ? homeroom.id : null;
        const homeroomLabel = homeroom ? homeroom.label : currentUser.cls;
        const anns = homeroomId
          ? dbGetList("announcements").filter((a) => a.classId === homeroomId)
          : [];
        const clsLabel = studentClsLabel();
        const assignments = dbGetList("assignments").filter(
          (a) => a.cls === clsLabel,
        );
        const submissions = dbGetList("submissions").filter(
          (s) => s.studentId === currentUser.id,
        );
        const pendingTasks = assignments.filter((a) => {
          const sub = submissions.find((s) => s.assignmentId === a.id);
          return !sub || sub.status !== "graded";
        });
        return `<div class="inner">
    <div class="ph">
      <h2>${homeroomLabel} <em>HomeRoom</em></h2>
      <p>${escapeHtml(currentUser.form)} · ${escapeHtml(homeroomLabel)} · Term 2, 2026 — ${escapeHtml(currentUser.name)}</p>
    </div>
    <div class="g4" style="margin-bottom:22px">
      <div class="stat cr"><div class="stat-icon">📢</div><div class="stat-num">${anns.length}</div><div class="stat-label">Class Announcements</div></div>
      <div class="stat nv"><div class="stat-icon">📝</div><div class="stat-num">${assignments.length}</div><div class="stat-label">Class Tasks</div></div>
      <div class="stat gd"><div class="stat-icon">⏰</div><div class="stat-num">${pendingTasks.length}</div><div class="stat-label">Outstanding</div></div>
      <div class="stat gr"><div class="stat-icon">👥</div><div class="stat-num">${homeroomLabel}</div><div class="stat-label">My Homeroom</div></div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-title">📣 School Notices</div>
        ${anns.length ? renderAnnouncements(4, false, homeroomId) : `<p style="font-size:13px;color:var(--ink-35)">No announcements for ${homeroomLabel} yet. Your homeroom teacher hasn't posted anything for this class.</p>`}
      </div>
      <div class="card">
        <div class="card-title">📅 My Tasks</div>
        ${
          assignments.length
            ? assignments
                .map((a) => {
                  const sub = submissions.find((s) => s.assignmentId === a.id);
                  let statusHtml;
                  if (sub && sub.status === "graded") {
                    statusHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:rgba(58,122,92,.12);color:#3A7A5C">Graded</span>`;
                  } else if (sub) {
                    statusHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:var(--gold-pale);color:var(--gold)">Submitted</span>`;
                  } else {
                    statusHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:var(--crimson-pale);color:var(--crimson)">Not submitted</span>`;
                  }
                  return `
          <div class="list-item">
            <div class="li-dot ${sub && sub.status === "graded" ? "dz" : sub ? "dg" : "dc"}"></div>
            <div class="li-main">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <div class="li-title">${escapeHtml(a.title)}</div>
                ${statusHtml}
              </div>
              <div class="li-sub">${escapeHtml(a.subject)} · Due ${a.due}</div>
            </div>
          </div>`;
                })
                .join("")
            : `<p style="font-size:13px;color:var(--ink-35)">No tasks assigned for your class right now.</p>`
        }
        <button class="btn btn-ghost" style="width:100%;margin-top:10px;font-size:12px" onclick="navigateTo('portal')">📚 View Classes & Assignments →</button>
      </div>
    </div>
  </div>`;
      }


      function subjectKey(s) {
        const map = {
          mathematics: "maths",
          maths: "maths",
          math: "maths",
          physics: "physics",
          biology: "biology",
          chemistry: "chemistry",
          history: "history",
          "english literature": "english",
          english: "english",
          "computer science": "compsci",
          "comp sci": "compsci",
          cs: "compsci",
          ict: "ict",
        };
        const k = (s || "").trim().toLowerCase();
        return map[k] || k;
      }

      function studentClsLabel() {
        return `${currentUser.form} · ${currentUser.cls}`;
      }

      function classNotesFor(subject) {
        return dbGetList("class_notes")
          .filter((n) => n.subject === subject)
          .sort((a, b) => b.time - a.time);
      }

      function assignmentsForSubject(subject) {
        const clsLabel = studentClsLabel();
        return dbGetList("assignments")
          .filter(
            (a) =>
              a.cls === clsLabel && subjectKey(a.subject) === subjectKey(subject),
          )
          .sort((a, b) => new Date(a.due) - new Date(b.due));
      }

      function mySubmissionFor(assignmentId) {
        return dbGetList("submissions").find(
          (s) => s.assignmentId === assignmentId && s.studentId === currentUser.id,
        );
      }

      function openClassDetail(idx) {
        const c = STUDENT_SUBJECTS[idx];
        if (!c) return;
        const notes = classNotesFor(c.sub);
        const assignments = assignmentsForSubject(c.sub);
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "class-detail-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:620px;max-height:85vh;overflow-y:auto">
      <div class="modal-title">${c.emoji} ${escapeHtml(c.sub)}</div>
      <p style="font-size:12px;color:var(--ink-35);margin-top:-14px;margin-bottom:18px">${escapeHtml(c.t)} · ${escapeHtml(c.rm)}</p>

      <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-60);margin-bottom:10px">📝 Latest Notes</div>
      ${
        notes.length
          ? notes
              .map(
                (n) => `
        <div class="list-item">
          <div class="li-dot dn"></div>
          <div class="li-main">
            <div class="li-title">${escapeHtml(n.title)}</div>
            <div style="font-size:13px;color:var(--ink-60);margin-top:4px;line-height:1.5">${escapeHtml(n.body)}</div>
            <div class="li-sub" style="margin-top:6px">${escapeHtml(n.author)} · ${timeAgo(n.time)}</div>
          </div>
        </div>`,
              )
              .join("")
          : `<p style="font-size:13px;color:var(--ink-35)">No notes posted for this class yet.</p>`
      }

      <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-60);margin:20px 0 10px">📚 Assignments</div>
      ${
        assignments.length
          ? assignments
              .map((a) => {
                const sub = mySubmissionFor(a.id);
                const max = a.marks || 100;
                let statusHtml;
                if (sub && sub.status === "graded") {
                  statusHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:rgba(58,122,92,.12);color:#3A7A5C">Graded · ${sub.grade}/${max}</span>`;
                } else if (sub) {
                  statusHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:var(--gold-pale);color:var(--gold)">Submitted</span>`;
                } else {
                  statusHtml = `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:var(--crimson-pale);color:var(--crimson)">Not submitted</span>`;
                }
                return `
        <div class="arow" style="align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="font-size:14px;font-weight:500;color:var(--ink)">${escapeHtml(a.title)}</div>
              ${statusHtml}
            </div>
            <div style="font-size:12px;color:var(--ink-35);margin-top:4px">Due ${a.due}</div>
            ${
              sub && sub.status === "graded" && sub.feedback
                ? `<div style="font-size:12px;color:var(--ink-60);margin-top:6px;font-style:italic">“${escapeHtml(sub.feedback)}”</div>`
                : ""
            }
          </div>
          <button class="btn ${sub ? "btn-ghost" : "btn-crimson"}" style="font-size:12px;padding:7px 11px;flex-shrink:0" onclick="openSubmitAssignment('${a.id}')" ${sub && sub.status === "graded" ? "disabled" : ""}>${sub ? (sub.status === "graded" ? "Graded" : "Resubmit") : "Submit"}</button>
        </div>`;
              })
              .join("")
          : `<p style="font-size:13px;color:var(--ink-35)">No assignments for this class right now.</p>`
      }

      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('class-detail-modal').remove()">Close</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
      }

      // ─── ASSIGNMENT SUBMISSION (student) ──────────────────
      let pendingSubmissionFile = null;

      function openSubmitAssignment(assignmentId) {
        const a = dbGetList("assignments").find((x) => x.id === assignmentId);
        if (!a) return;
        const existing = mySubmissionFor(assignmentId);
        if (existing && existing.status === "graded") {
          showToast("This assignment has already been graded", "err");
          return;
        }
        pendingSubmissionFile = null;
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "submit-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-title">📤 ${existing ? "Resubmit" : "Submit"}: ${escapeHtml(a.title)}</div>
      <p style="font-size:12px;color:var(--ink-35);margin-top:-14px;margin-bottom:16px">${escapeHtml(a.subject)} · ${escapeHtml(a.cls)} · Due ${a.due}</p>
      <div class="ffield" style="margin-bottom:14px">
        <div class="flabel">Your Response</div>
        <textarea class="ftextarea" id="sub-text" placeholder="Type your answer or notes here…" style="min-height:120px">${existing ? escapeHtml(existing.text || "") : ""}</textarea>
      </div>
      <div class="ffield" style="margin-bottom:6px">
        <div class="flabel">Attach File (optional, max 3MB)</div>
        <input class="finput" type="file" id="sub-file" onchange="handleSubmissionFile(this)">
        <div id="sub-file-name" style="font-size:12px;color:var(--ink-35);margin-top:6px">${existing && existing.fileName ? "Current file: " + escapeHtml(existing.fileName) : ""}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-crimson" onclick="saveSubmission('${assignmentId}')">${existing ? "Resubmit" : "Submit"}</button>
        <button class="btn btn-ghost" onclick="document.getElementById('submit-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
      }

      function handleSubmissionFile(input) {
        const file = input.files[0];
        if (!file) {
          pendingSubmissionFile = null;
          return;
        }
        if (file.size > 3 * 1024 * 1024) {
          showToast("File too large — max 3MB", "err");
          input.value = "";
          pendingSubmissionFile = null;
          return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          pendingSubmissionFile = {
            name: file.name,
            dataUrl: e.target.result,
          };
          const nameEl = document.getElementById("sub-file-name");
          if (nameEl) nameEl.textContent = "Selected: " + file.name;
        };
        reader.readAsDataURL(file);
      }

      function saveSubmission(assignmentId) {
        const textEl = document.getElementById("sub-text");
        const text = textEl ? textEl.value.trim() : "";
        const existing = mySubmissionFor(assignmentId);
        if (!text && !pendingSubmissionFile && !(existing && existing.fileName)) {
          showToast("Please write a response or attach a file", "err");
          return;
        }
        const submissions = dbGetList("submissions");
        const assignments = dbGetList("assignments");
        const a = assignments.find((x) => x.id === assignmentId);

        if (existing) {
          const idx = submissions.findIndex((s) => s.id === existing.id);
          submissions[idx] = {
            ...existing,
            text,
            fileName: pendingSubmissionFile
              ? pendingSubmissionFile.name
              : existing.fileName,
            fileData: pendingSubmissionFile
              ? pendingSubmissionFile.dataUrl
              : existing.fileData,
            submittedAt: Date.now(),
            status: "submitted",
          };
        } else {
          submissions.push({
            id: dbGenId("sub"),
            assignmentId,
            studentId: currentUser.id,
            studentName: currentUser.name,
            text,
            fileName: pendingSubmissionFile ? pendingSubmissionFile.name : null,
            fileData: pendingSubmissionFile ? pendingSubmissionFile.dataUrl : null,
            submittedAt: Date.now(),
            status: "submitted",
            grade: null,
            feedback: null,
            gradedAt: null,
          });
          if (a) {
            a.submitted = (a.submitted || 0) + 1;
            dbSaveList("assignments", assignments);
          }
        }
        dbSaveList("submissions", submissions);
        pendingSubmissionFile = null;
        const submitModal = document.getElementById("submit-modal");
        if (submitModal) submitModal.remove();
        const detailModal = document.getElementById("class-detail-modal");
        if (detailModal) detailModal.remove();
        showToast("Assignment submitted ✓");
        if (a) {
          const idx = STUDENT_SUBJECTS.findIndex(
            (c) => subjectKey(c.sub) === subjectKey(a.subject),
          );
          if (idx !== -1) openClassDetail(idx);
        }
      }


