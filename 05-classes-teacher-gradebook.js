      // ══════════════════════════════════════════════════════
      // ─── REPORT CARDS (teacher side — enter student marks) ─
      // ══════════════════════════════════════════════════════
      function teacherReportCards() {
        const myStudents = dbGetList("users")
          .filter((u) => u.role === "student")
          .map((u) => {
            const rcData = buildReportCard(u.id);
            const mySubjects = rcData.filter(
              (s) => s.teacherId === currentUser.id,
            );
            return { user: u, subjects: mySubjects };
          })
          .filter((x) => x.subjects.length > 0);
        return `<div class="inner">
    <button class="btn btn-ghost" style="margin-bottom:18px;font-size:12px" onclick="hideGradebookReportCards()">← Gradebook</button>
    <div class="ph"><h2>Report <em>Cards</em></h2><p>Enter end-of-term marks for students you teach — ${escapeHtml(currentUser.name)}</p></div>
    ${
      myStudents.length === 0
        ? `<div class="card" style="text-align:center;padding:40px;color:var(--ink-35)">You don't have any students on a report card yet.</div>`
        : `<div class="g2">${myStudents
            .map(({ user, subjects }) => {
              const pendingCount = subjects.filter(
                (s) => s.displayMark === null,
              ).length;
              return `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:10px">
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <span class="ft-av ${user.av}" style="display:inline-flex;flex-shrink:0;width:38px;height:38px;border-radius:50%;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--ink)">${user.initials}</span>
            <div style="min-width:0"><div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:var(--navy)">${escapeHtml(user.name)}</div><div style="font-size:12px;color:var(--ink-35)">${user.form || ""}${user.cls ? " · " + user.cls : ""}</div></div>
          </div>
          ${pendingCount > 0 ? `<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:100px;background:var(--gold-pale);color:var(--gold);white-space:nowrap;flex-shrink:0">${pendingCount} pending</span>` : `<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:100px;background:rgba(58,122,92,0.12);color:#3A7A5C;white-space:nowrap;flex-shrink:0">✓ Complete</span>`}
        </div>
        <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:14px">
          ${subjects
            .map((s) => {
              const pending = s.displayMark === null;
              const symbol = pending ? null : rcSymbol(s.displayMark);
              const sourceLabel =
                s.source === "gradebook"
                  ? `<span style="font-size:10px;color:#3A7A5C;font-weight:500">📊 Auto</span>`
                  : s.source === "teacher"
                    ? `<span style="font-size:10px;color:var(--gold);font-weight:500">✏️ Manual</span>`
                    : ``;
              return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px"><span style="color:var(--ink-60)">${escapeHtml(s.subject)} ${sourceLabel}</span>${pending ? `<span style="color:var(--gold);font-weight:600">Pending</span>` : `<span style="font-weight:700;color:${rcColor(symbol)}">${symbol} · ${s.displayMark}/100</span>`}</div>`;
            })
            .join("")}
        </div>
        <button class="btn btn-crimson" style="width:100%" onclick="showReportCardModal('${user.id}')">📝 ${pendingCount > 0 ? "Enter Marks" : "Update Marks"}</button>
      </div>`;
            })
            .join("")}</div>`
    }
  </div>`;
      }

      function showReportCardModal(studentId, fallbackName) {
        const student = dbGetList("users").find((u) => u.id === studentId);
        if (!student) {
          showToast(
            `No report card on file for ${fallbackName || "this student"}`,
          );
          return;
        }
        const subjects = buildReportCard(studentId).filter(
          (s) => s.teacherId === currentUser.id,
        );
        if (!subjects.length) {
          showToast(`No report card subject set up for ${student.name} yet`);
          return;
        }
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "rc-modal";
        backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-title">📝 ${escapeHtml(student.name)} — Enter Marks</div>
      <div style="font-size:12px;color:var(--ink-35);margin-bottom:14px">${student.form || ""}${student.cls ? " · " + student.cls : ""} · Term 2, 2026</div>
      ${subjects
        .map((s, i) => {
          const computed = s.source === "gradebook" ? s.displayMark : null;
          return `<div class="ffield" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div class="flabel">${escapeHtml(s.subject)} (out of 100)</div>
            ${computed !== null ? `<span style="font-size:11px;color:#3A7A5C;font-weight:500">📊 Gradebook: ${computed}%</span>` : ""}
          </div>
          <input class="finput" type="number" min="0" max="100" id="rc-mark-${i}" placeholder="${computed !== null ? "Blank = use gradebook" : "0–100"}" value="${s.source === "teacher" && s.displayMark !== null ? s.displayMark : ""}">
          ${computed !== null ? `<div style="font-size:11px;color:var(--ink-35);margin-top:3px">Leave blank to use gradebook average (${computed}%)</div>` : ""}
        </div>`;
        })
        .join("")}
      <div class="modal-footer">
        <button class="btn btn-crimson" onclick="saveReportCardMarks('${studentId}')">Save Marks</button>
        <button class="btn btn-ghost" onclick="document.getElementById('rc-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
      }

      function saveReportCardMarks(studentId) {
        const key = "report_card_" + studentId;
        const all = dbGetList(key);
        const mySubjects = all.filter((s) => s.teacherId === currentUser.id);
        let anyError = false;
        mySubjects.forEach((s, i) => {
          const input = document.getElementById(`rc-mark-${i}`);
          if (!input) return;
          const val = input.value.trim();
          if (val === "") {
            s.mark = null; // Will fall back to gradebook
            return;
          }
          const num = parseInt(val, 10);
          if (isNaN(num) || num < 0 || num > 100) {
            anyError = true;
            return;
          }
          s.mark = num;
        });
        if (anyError) {
          showToast("Marks must be whole numbers between 0 and 100", "err");
          return;
        }
        dbSaveList(key, all);
        document.getElementById("rc-modal").remove();
        renderGradebookPage();
        const student = dbGetList("users").find((u) => u.id === studentId);
        showToast(`Marks saved for ${student ? student.name : "student"} ✓`);
      }

      // ══════════════════════════════════════════════════════
      // ─── ADMIN STAFF// ══════════════════════════════════════════════════════
      // ─── ADMIN STAFF (DB-backed, add/remove/edit) ─────────
      // ══════════════════════════════════════════════════════
      let staffFilter = "";

      function adminStaff() {
        const staff = dbGetList("staff");
        return `<div class="inner">
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2>Teaching <em>Staff</em></h2><p>All staff members · ${staff.length} records</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="navigateTo('accounts')">🔑 Manage Login Accounts</button>
        <button class="btn btn-crimson" onclick="showAddStaff()">+ Add Staff</button>
      </div>
    </div>
    <div class="card">
      <div class="search-bar">
        <span>🔍</span>
        <input placeholder="Search by name, subject or department…" oninput="filterStaff(this.value)" value="${staffFilter}">
      </div>
      <div style="overflow-x:auto">
        <table class="tt" id="staff-table">
          <thead><tr><th>#</th><th>Name</th><th>Subject(s)</th><th>Department</th><th>Room</th><th>Exp.</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="staff-tbody">${renderStaffRows(staffFilter)}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:8px">
        <div id="staff-count" style="font-size:13px;color:var(--ink-60)">Showing ${staff.length} staff members</div>
        <div style="display:flex;gap:8px">
          <span class="sbadge s-active">✅ ${staff.filter((t) => t.status === "active").length} Active</span>
          <span class="sbadge s-leave">🟡 ${staff.filter((t) => t.status === "leave").length} On Leave</span>
          <span class="sbadge s-sub">🔵 ${staff.filter((t) => t.status === "sub").length} Substitute</span>
        </div>
      </div>
    </div>
  </div>`;
      }

      function renderStaffRows(q = "") {
        const staff = dbGetList("staff");
        const filtered = q
          ? staff.filter(
              (t) =>
                t.name.toLowerCase().includes(q.toLowerCase()) ||
                t.subj.toLowerCase().includes(q.toLowerCase()) ||
                t.dept.toLowerCase().includes(q.toLowerCase()),
            )
          : staff;
        return filtered
          .map(
            (t, i) => `
    <tr>
      <td style="color:var(--ink-35);font-weight:600">${i + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="ft-av ${t.av}" style="width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--ink);flex-shrink:0">
            ${t.name
              .split(" ")
              .filter((_, i) => i > 0)
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </span>
          <span style="font-weight:500">${escapeHtml(t.name)}</span>
        </div>
      </td>
      <td style="color:var(--ink-60);max-width:200px">${t.subj}</td>
      <td><span style="font-size:12px;font-weight:600;padding:3px 9px;border-radius:100px;background:var(--ivory);border:1px solid var(--ink-12)">${t.dept}</span></td>
      <td style="color:var(--ink-60)">${t.rm}</td>
      <td style="color:var(--ink-60)">${t.exp} yr${t.exp !== 1 ? "s" : ""}</td>
      <td>
        <select class="fselect" style="width:120px;padding:4px 8px;font-size:11px" onchange="updateStaffStatus('${t.id}',this.value)">
          <option value="active" ${t.status === "active" ? "selected" : ""}>✅ Active</option>
          <option value="leave"  ${t.status === "leave" ? "selected" : ""}>🟡 On Leave</option>
          <option value="sub"    ${t.status === "sub" ? "selected" : ""}>🔵 Substitute</option>
        </select>
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" data-no-translate style="padding:5px 10px;font-size:11px" onclick="showEditStaff('${t.id}')">✏️ Edit</button>
        </div>
      </td>
    </tr>`,
          )
          .join("");
      }

      function filterStaff(q) {
        staffFilter = q;
        const tbody = document.getElementById("staff-tbody");
        const countEl = document.getElementById("staff-count");
        if (tbody) tbody.innerHTML = renderStaffRows(q);
        if (countEl) {
          const staff = dbGetList("staff");
          const count = q
            ? staff.filter(
                (t) =>
                  t.name.toLowerCase().includes(q.toLowerCase()) ||
                  t.subj.toLowerCase().includes(q.toLowerCase()) ||
                  t.dept.toLowerCase().includes(q.toLowerCase()),
              ).length
            : staff.length;
          countEl.textContent = `Showing ${count} of ${staff.length} staff members`;
        }
      }

      function updateStaffStatus(id, status) {
        const staff = dbGetList("staff");
        const t = staff.find((s) => s.id === id);
        if (!t) return;
        t.status = status;
        dbSaveList("staff", staff);
        showToast(`Status updated for ${t.name}`);
      }

      function showAddStaff() {
        showStaffModal(null);
      }

      function showEditStaff(id) {
        showStaffModal(id);
      }

      function showStaffModal(editId) {
        const staff = dbGetList("staff");
        const existing = editId ? staff.find((s) => s.id === editId) : null;
        const depts = [
          "STEM",
          "Humanities",
          "Sciences",
          "Commerce",
          "Languages",
          "Creative Arts",
          "Technical",
          "PE & Health",
          "Support",
        ];
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "staff-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-title">${existing ? "✏️ Edit Staff Member" : "+ Add Staff Member"}</div>
      <div class="frow">
        <div class="ffield"><div class="flabel">Full Name</div><input class="finput" id="sf-name" value="${existing?.name || ""}"></div>
        <div class="ffield"><div class="flabel">Room</div><input class="finput" id="sf-rm" value="${existing?.rm || ""}" placeholder="e.g. Rm 7"></div>
      </div>
      <div class="ffield" style="margin-bottom:12px"><div class="flabel">Subject(s)</div><input class="finput" id="sf-subj" value="${existing?.subj || ""}" placeholder="e.g. Mathematics / Physics"></div>
      <div class="frow">
        <div class="ffield"><div class="flabel">Department</div>
          <select class="fselect" id="sf-dept">
            ${depts.map((d) => `<option ${existing?.dept === d ? "selected" : ""}>${d}</option>`).join("")}
          </select>
        </div>
        <div class="ffield"><div class="flabel">Experience (years)</div><input class="finput" type="number" id="sf-exp" value="${existing?.exp || 1}" min="0"></div>
        <div class="ffield"><div class="flabel">Status</div>
          <select class="fselect" id="sf-status">
            <option value="active" ${existing?.status === "active" ? "selected" : ""}>✅ Active</option>
            <option value="leave"  ${existing?.status === "leave" ? "selected" : ""}>🟡 On Leave</option>
            <option value="sub"    ${existing?.status === "sub" ? "selected" : ""}>🔵 Substitute</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="flex-wrap:wrap;gap:10px">
        <button class="btn btn-crimson" onclick="saveStaff('${editId || ""}')">${existing ? "Save Changes" : "Add to Staff"}</button>
        ${existing ? `<button class="btn btn-danger" onclick="removeStaff('${editId}')">🗑 Delete</button>` : ""}
        <button class="btn btn-ghost" onclick="document.getElementById('staff-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
      }

      function saveStaff(editId) {
        const name = document.getElementById("sf-name").value.trim();
        const subj = document.getElementById("sf-subj").value.trim();
        const dept = document.getElementById("sf-dept").value;
        const rm = document.getElementById("sf-rm").value.trim();
        const exp = parseInt(document.getElementById("sf-exp").value) || 0;
        const status = document.getElementById("sf-status").value;
        if (!name || !subj) {
          showToast("Name and subjects are required", "err");
          return;
        }
        if (!isValidName(name)) {
          showToast("Name may only contain letters, spaces, hyphens, and apostrophes.", "err");
          return;
        }
        const staff = dbGetList("staff");
        const avColors = [
          "av1",
          "av2",
          "av3",
          "av4",
          "av5",
          "av6",
          "av7",
          "av8",
          "av9",
          "av0",
        ];
        if (editId) {
          const t = staff.find((s) => s.id === editId);
          if (t) {
            t.name = name;
            t.subj = subj;
            t.dept = dept;
            t.rm = rm;
            t.exp = exp;
            t.status = status;
          }
        } else {
          staff.push({
            id: dbGenId("t"),
            name,
            subj,
            dept,
            rm,
            exp,
            status,
            av: avColors[staff.length % 10],
          });
        }
        dbSaveList("staff", staff);
        document.getElementById("staff-modal").remove();
        navigateTo("admin");
        showToast(
          editId ? "Staff member updated ✓" : `${name} added to staff ✓`,
        );
      }

      function removeStaff(id) {
        let staff = dbGetList("staff");
        const t = staff.find((s) => s.id === id);
        if (!t) return;
        if (!confirm(`Delete ${t.name} from the staff database?`)) return;
        staff = staff.filter((s) => s.id !== id);
        dbSaveList("staff", staff);
        const modal = document.getElementById("staff-modal");
        if (modal) modal.remove();
        navigateTo("admin");
        showToast(`${t.name} removed`);
      }

      // ══════════════════════════════════════════════════════
      // ─── ADMIN ACCOUNTS (create teacher / admin logins) ───
      // ══════════════════════════════════════════════════════
      function accessDenied() {
        return `<div class="inner">
    <div class="ph"><h2>Access <em>Denied</em></h2><p>Only administrators can view this page.</p></div>
  </div>`;
      }

      let accountsFilter = "";

function adminAccounts() {
  if (!currentUser || currentUser.role !== "admin") return accessDenied();
  const users = dbGetList("users");
  const staff = users.filter((u) => u.role !== "student");
  const students = users.filter((u) => u.role === "student");
  const suspended = users.filter((u) => u.suspended).length;
  return `<div class="inner">
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2>All <em>Accounts</em></h2><p>All registered users · ${users.length} accounts (${staff.length} staff, ${students.length} students)${suspended ? ` · <span style="color:#dc3545">${suspended} suspended</span>` : ''}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="navigateTo('admin')">📋 Staff Directory</button>
        <button class="btn btn-crimson" onclick="showAddAccountModal()">+ New Account</button>
      </div>
    </div>
    <!-- Sub-tabs -->
    <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border)">
      <button id="atab-accounts" class="btn btn-ghost" style="border-radius:8px 8px 0 0;border-bottom:3px solid var(--crimson);padding:8px 18px;font-weight:600" onclick="switchAccountsTab('accounts')">👥 Users</button>
      <button id="atab-sessions" class="btn btn-ghost" style="border-radius:8px 8px 0 0;border-bottom:3px solid transparent;padding:8px 18px" onclick="switchAccountsTab('sessions')">🖥 Active Sessions</button>
      <button id="atab-history" class="btn btn-ghost" style="border-radius:8px 8px 0 0;border-bottom:3px solid transparent;padding:8px 18px" onclick="switchAccountsTab('history')">📋 Login History</button>
    </div>

    <!-- Users tab -->
    <div id="atab-panel-accounts" class="card">
      <div class="search-bar">
        <span>🔍</span>
        <input placeholder="Search by ID, name, email, role or class…" oninput="filterAccounts(this.value)" value="${accountsFilter}">
      </div>
      <div style="overflow-x:auto">
        <table class="tt" id="accounts-table">
          <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Department/Class</th><th>Actions</th></tr></thead>
          <tbody id="accounts-tbody">${renderAccountRows(accountsFilter)}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:8px">
        <div id="accounts-count" style="font-size:13px;color:var(--ink-60)">Showing ${accountsFilter ? users.filter((u) => (u.uid && u.uid.toLowerCase().includes(accountsFilter.toLowerCase())) || u.name.toLowerCase().includes(accountsFilter.toLowerCase()) || u.email.toLowerCase().includes(accountsFilter.toLowerCase()) || u.role.toLowerCase().includes(accountsFilter.toLowerCase()) || (u.form && u.form.toLowerCase().includes(accountsFilter.toLowerCase())) || (u.cls && u.cls.toLowerCase().includes(accountsFilter.toLowerCase())) || (u.dept && u.dept.toLowerCase().includes(accountsFilter.toLowerCase()))).length + " of " : ""}${users.length} accounts</div>
        <div style="display:flex;gap:8px">
          <span class="sbadge s-active">👨‍🏫 ${staff.filter((u) => u.role === "teacher").length} Teachers</span>
          <span class="sbadge s-sub">🛡 ${staff.filter((u) => u.role === "admin").length} Admins</span>
          <span class="sbadge s-leave">📚 ${students.length} Students</span>
          <span class="sbadge" style="background:rgba(122,64,128,0.12);color:#7a4080;border:1px solid rgba(122,64,128,0.2)">👨‍👩‍👧 ${users.filter((u) => u.role === "parent").length} Parents</span>
          ${suspended ? `<span class="sbadge" style="background:rgba(220,53,69,0.12);color:#dc3545;border:1px solid rgba(220,53,69,0.2)">🔴 ${suspended} Suspended</span>` : ''}
        </div>
      </div>
    </div>

    <!-- Active Sessions tab -->
    <div id="atab-panel-sessions" class="card" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-weight:600;color:var(--navy)">🖥 Currently Active Sessions</div>
        <button class="btn btn-ghost" style="font-size:12px;padding:6px 12px" onclick="renderActiveSessions()">↻ Refresh</button>
      </div>
      <div id="active-sessions-content"><div style="text-align:center;padding:40px;color:var(--ink-35)">Click Refresh to load sessions.</div></div>
    </div>

    <!-- Login History tab -->
    <div id="atab-panel-history" class="card" style="display:none">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-weight:600;color:var(--navy)">📋 All Login History (last 200)</div>
        <button class="btn btn-ghost" style="font-size:12px;padding:6px 12px" onclick="renderAdminLoginHistory()">↻ Refresh</button>
      </div>
      <div id="all-login-hist-content"><div style="text-align:center;padding:40px;color:var(--ink-35)">Click Refresh to load history.</div></div>
    </div>
  </div>`;
}

function switchAccountsTab(tab) {
  ["accounts", "sessions", "history"].forEach(t => {
    const btn = document.getElementById("atab-" + t);
    const panel = document.getElementById("atab-panel-" + t);
    if (btn) btn.style.borderBottomColor = t === tab ? "var(--crimson)" : "transparent";
    if (btn) btn.style.fontWeight = t === tab ? "600" : "400";
    if (panel) panel.style.display = t === tab ? "" : "none";
  });
  if (tab === "sessions") renderActiveSessions();
  if (tab === "history") renderAdminLoginHistory();
}


      function renderAccountRows(filter) {
        const users = dbGetList("users");
        const filtered = filter
          ? users.filter((u) =>
              (u.uid && u.uid.toLowerCase().includes(filter.toLowerCase())) ||
              u.name.toLowerCase().includes(filter.toLowerCase()) ||
              u.email.toLowerCase().includes(filter.toLowerCase()) ||
              u.role.toLowerCase().includes(filter.toLowerCase()) ||
              (u.form && u.form.toLowerCase().includes(filter.toLowerCase())) ||
              (u.cls && u.cls.toLowerCase().includes(filter.toLowerCase())) ||
              (u.dept && u.dept.toLowerCase().includes(filter.toLowerCase()))
            )
          : users;

        const roleColors = {
          teacher: "u-role-t",
          admin: "u-role-a",
          student: "u-role-s",
          parent: "u-role-p",
        };
        const roleLabels = {
          teacher: t("badgeTeacher"),
          admin: t("badgeAdmin"),
          student: t("badgeStudent"),
          parent: t("badgeParent"),
        };

        return filtered
          .map((u) => {
            const deptClass =
              u.role === "student"
                ? `${u.form || ""} · ${u.cls || ""}`
                : u.dept || "—";
            return `
    <tr data-user-id="${u.id}" style="${u.suspended ? 'background:rgba(220,53,69,0.04)' : ''}">
      <td data-no-translate style="font-family:'Playfair Display',serif;font-weight:700;color:var(--navy)">${u.uid || "—"}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="ft-av ${u.av}" style="width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--ink);flex-shrink:0">${u.initials}</span>
          <div>
            <div data-no-translate style="font-weight:600">${escapeHtml(u.name)}</div>
            <div data-no-translate style="font-size:11px;color:var(--ink-35)">${u.email}</div>
          </div>
        </div>
      </td>
      <td data-no-translate style="color:var(--ink-60)">${u.email}</td>
      <td><span class="u-role ${roleColors[u.role] || ""}" style="font-size:10px">${roleLabels[u.role] || u.role}</span></td>
      <td>${u.suspended
        ? `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(220,53,69,0.12);color:#dc3545;font-weight:600">🔴 Suspended</span>`
        : `<span style="font-size:11px;color:var(--ink-35)">Active</span>`}</td>
      <td style="color:var(--ink-60)">${deptClass}</td>
      <td>
        <button class="btn btn-ghost" data-no-translate style="padding:5px 10px;font-size:11px" onclick="showEditAccountModal('${u.id}')">✏️ Edit</button>
      </td>
    </tr>`;
          })
          .join("");
      }

function filterAccounts(q) {
  accountsFilter = q;
  const tbody = document.getElementById("accounts-tbody");
  const countEl = document.getElementById("accounts-count");
  if (tbody) tbody.innerHTML = renderAccountRows(q);
  if (countEl) {
    const users = dbGetList("users");
    const filtered = q
      ? users.filter((u) =>
          (u.uid && u.uid.toLowerCase().includes(q.toLowerCase())) ||
          u.name.toLowerCase().includes(q.toLowerCase()) ||
          u.email.toLowerCase().includes(q.toLowerCase()) ||
          u.role.toLowerCase().includes(q.toLowerCase()) ||
          (u.form && u.form.toLowerCase().includes(q.toLowerCase())) ||
          (u.cls && u.cls.toLowerCase().includes(q.toLowerCase())) ||
          (u.dept && u.dept.toLowerCase().includes(q.toLowerCase()))
        )
      : users;
    countEl.textContent = `Showing ${q ? filtered.length + " of " : ""}${users.length} accounts`;
  }
}

      function showEditAccountModal(userId) {
        const users = dbGetList("users");
        const u = users.find((x) => x.id === userId);
        if (!u) return;
        const isSelf = u.id === currentUser.id;
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "edit-account-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-title">✏️ Edit Account</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <span class="ft-av ${u.av}" style="width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--ink);flex-shrink:0">${u.initials}</span>
        <div>
          <div style="font-weight:600;color:var(--navy)">${escapeHtml(u.name)}</div>
          <div style="font-size:12px;color:var(--ink-35)">${u.email} · ID: ${u.uid || "—"}</div>
        </div>
      </div>
      <div class="frow">
        <div class="ffield"><div class="flabel">Full Name</div><input class="finput" id="edit-name" value="${escapeHtml(u.name)}"></div>
        <div class="ffield"><div class="flabel">ID Number</div><input class="finput" id="edit-uid" value="${u.uid || ""}" placeholder="e.g., 10-0001 / T-001 / A-001"></div>
      </div>
      <div class="frow">
        <div class="ffield"><div class="flabel">Email</div><input class="finput" type="email" id="edit-email" value="${u.email}"></div>
        <div class="ffield"><div class="flabel">Initials</div><input class="finput" id="edit-initials" value="${u.initials || ""}" placeholder="e.g., SH" maxlength="2"></div>
      </div>
      <div class="frow">
        <div class="ffield"><div class="flabel">Role</div>
          <select class="fselect" id="edit-role" ${isSelf ? 'disabled title="Cannot change your own role"' : ""}>
            <option value="student" ${u.role === "student" ? "selected" : ""}>📚 Student</option>
            <option value="teacher" ${u.role === "teacher" ? "selected" : ""}>🎓 Teacher</option>
            <option value="parent" ${u.role === "parent" ? "selected" : ""}>👨‍👩‍👧 Parent</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>🛡 Admin</option>
          </select>
        </div>
        <div class="ffield"><div class="flabel">Avatar Colour</div>
          <select class="fselect" id="edit-av">
            <option value="av1" ${u.av === "av1" ? "selected" : ""}>Pink</option>
            <option value="av2" ${u.av === "av2" ? "selected" : ""}>Blue</option>
            <option value="av3" ${u.av === "av3" ? "selected" : ""}>Green</option>
            <option value="av4" ${u.av === "av4" ? "selected" : ""}>Gold</option>
            <option value="av5" ${u.av === "av5" ? "selected" : ""}>Purple</option>
            <option value="av6" ${u.av === "av6" ? "selected" : ""}>Cyan</option>
            <option value="av7" ${u.av === "av7" ? "selected" : ""}>Orange</option>
            <option value="av8" ${u.av === "av8" ? "selected" : ""}>Lime</option>
            <option value="av9" ${u.av === "av9" ? "selected" : ""}>Magenta</option>
            <option value="av0" ${u.av === "av0" ? "selected" : ""}>Teal</option>
          </select>
        </div>
      </div>
      ${
        u.role === "student"
          ? `
      <div class="frow">
        <div class="ffield"><div class="flabel">Form</div><input class="finput" id="edit-form" value="${u.form || ""}" placeholder="e.g., Form 4"></div>
        <div class="ffield"><div class="flabel">Class</div><input class="finput" id="edit-cls" value="${u.cls || ""}" placeholder="e.g., 10B"></div>
      </div>`
          : u.role === "parent"
            ? `
      <div class="frow">
        <div class="ffield"><div class="flabel">Child Student</div>
          <select class="fselect" id="edit-child">
            <option value="">— Select —</option>
            ${dbGetList("users")
              .filter((s) => s.role === "student")
              .map(
                (s) =>
                  `<option value="${s.id}" ${u.childId === s.id ? "selected" : ""}>${escapeHtml(s.name)} (${s.form} ${s.cls})</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="ffield"><div class="flabel">Child Name</div><input class="finput" id="edit-child-name" value="${u.childName || ""}" placeholder="e.g. Jane Doe"></div>
      </div>`
            : u.role === "teacher"
              ? `
      <div class="ffield" style="margin-bottom:12px"><div class="flabel">Department</div>
        <select class="fselect" id="edit-dept">
          <option ${u.dept === "STEM" ? "selected" : ""}>STEM</option>
          <option ${u.dept === "Humanities" ? "selected" : ""}>Humanities</option>
          <option ${u.dept === "Sciences" ? "selected" : ""}>Sciences</option>
          <option ${u.dept === "Commerce" ? "selected" : ""}>Commerce</option>
          <option ${u.dept === "Languages" ? "selected" : ""}>Languages</option>
          <option ${u.dept === "Creative Arts" ? "selected" : ""}>Creative Arts</option>
          <option ${u.dept === "Technical" ? "selected" : ""}>Technical</option>
          <option ${u.dept === "PE & Health" ? "selected" : ""}>PE & Health</option>
          <option ${u.dept === "Support" ? "selected" : ""}>Support</option>
        </select>
      </div>`
              : ""
      }
      <div class="login-err" id="edit-err" style="display:none"></div>
      ${!isSelf ? `
      <div style="margin:12px 0 4px;padding:12px;border-radius:8px;background:${u.suspended ? 'rgba(220,53,69,0.08)' : 'rgba(0,0,0,0.04)'};border:1px solid ${u.suspended ? 'rgba(220,53,69,0.25)' : 'var(--border)'}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-weight:600;font-size:13px;color:${u.suspended ? '#dc3545' : 'var(--ink)'}">
              ${u.suspended ? '🔴 Account Suspended' : '🟢 Account Active'}
            </div>
            ${u.suspended && u.suspendedReason ? `<div style="font-size:11px;color:var(--ink-60);margin-top:2px">Reason: ${u.suspendedReason}</div>` : ''}
          </div>
          <button class="btn ${u.suspended ? 'btn-crimson' : ''}" style="font-size:11px;padding:5px 12px;${!u.suspended ? 'border:1px solid #dc3545;color:#dc3545;background:transparent' : ''}"
            onclick="${u.suspended ? `unsuspendAccount('${u.id}')` : `showSuspendModal('${u.id}')`}">
            ${u.suspended ? '✅ Unsuspend' : '🚫 Suspend Account'}
          </button>
        </div>
        ${!u.suspended ? `<div style="margin-top:8px"><input class="finput" id="edit-suspend-reason" placeholder="Suspension reason (optional)" style="font-size:12px;padding:6px 10px"></div>` : ''}
      </div>` : ''}
      <div class="modal-footer" style="flex-wrap:wrap;gap:8px">
        <button class="btn btn-crimson" onclick="saveAccountEdit('${u.id}')">Save Changes</button>
        <button class="btn btn-ghost" onclick="showChangePasswordModal('${u.id}')">🔑 Password</button>
        ${!isSelf ? `<button class="btn btn-ghost" style="border-color:var(--crimson);color:var(--crimson)" onclick="adminForceLogout('${escapeHtml(u.id)}','${escapeHtml(u.name)}')">⏏ Force Logout</button>` : ''}
        <button class="btn btn-ghost" onclick="showUserLoginHistory('${escapeHtml(u.id)}','${escapeHtml(u.name)}')">📋 Login History</button>
        <button class="btn btn-danger" ${isSelf ? 'disabled title="You cannot delete your own account"' : ""} onclick="${isSelf ? '' : `deleteAccount('${u.id}')`}">🗑 Delete</button>
        <button class="btn btn-ghost" onclick="document.getElementById('edit-account-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
        document.getElementById("edit-name").focus();
      }

      function saveAccountEdit(userId) {
        const name = document.getElementById("edit-name").value.trim();
        const uid = document.getElementById("edit-uid").value.trim();
        const email = document
          .getElementById("edit-email")
          .value.trim()
          .toLowerCase();
        const role = document.getElementById("edit-role").value;
        const err = document.getElementById("edit-err");
        const showErr = (msg) => {
          err.textContent = "⚠️ " + msg;
          err.style.display = "block";
        };

        if (!name || !email) {
          showErr("Name and email are required.");
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

        const users = dbGetList("users");
        if (users.some((u) => u.email === email && u.id !== userId)) {
          showErr("Another account already uses this email.");
          return;
        }

        const u = users.find((x) => x.id === userId);
        if (!u) return;
        const wasStudent = u.role === "student";
        const oldCls = u.cls;

        const customInitials = document.getElementById("edit-initials")?.value.trim().toUpperCase();
        const customAv = document.getElementById("edit-av")?.value;
        u.name = name;
        u.uid = uid || u.uid;
        u.email = email;
        u.initials = customInitials || name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        if (customAv) u.av = customAv;
        if (u.id !== currentUser.id) u.role = role;

        if (role === "student") {
          u.form = document.getElementById("edit-form")?.value.trim() || u.form;
          u.cls = document.getElementById("edit-cls")?.value.trim() || u.cls;
          delete u.dept;
          delete u.childId;
          delete u.childName;
        } else if (role === "teacher") {
          u.dept = document.getElementById("edit-dept")?.value || u.dept;
          delete u.form;
          delete u.cls;
          delete u.childId;
          delete u.childName;
        } else if (role === "parent") {
          u.childId = document.getElementById("edit-child")?.value || u.childId;
          u.childName =
            document.getElementById("edit-child-name")?.value.trim() ||
            u.childName;
          delete u.form;
          delete u.cls;
          delete u.dept;
        }

        dbSaveList("users", users);
        // If this student moved classes, relocate their linked roster
        // entry from the old class's homeroom/gradebook to the new one
        // — name/avatar edits sync automatically via live lookup, but a
        // class change means the roster *membership* itself must move.
        if (wasStudent && role === "student" && oldCls !== u.cls) {
          moveStudentBetweenRosters(userId, oldCls, u.cls);
        }
        // ── Sync Engine: push name/init/av changes to all linked rosters ──
        const syncCount = syncAccountToAllRosters(userId);
        if (syncCount > 0) console.log("[Sync] Account edit synced to " + syncCount + " stores");
        addAuditLogEntry("account_edited", userId, name, `Edited account: ${name} (${role}) by ${currentUser.name}`);
        // If admin edited their own account, refresh the topbar
        if (userId === currentUser.id) {
          currentUser = u;
          buildShell();
        }
        document.getElementById("edit-account-modal").remove();
        navigateTo("accounts");
        showToast(`Account updated for ${name} ✓`);
      }

      function showChangePasswordModal(userId) {
        const users = dbGetList("users");
        const u = users.find((x) => x.id === userId);
        if (!u) return;
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "pwd-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-title">🔑 Change Password</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <span class="ft-av ${u.av}" style="width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--ink);flex-shrink:0">${u.initials}</span>
        <div>
          <div style="font-weight:600;color:var(--navy)">${escapeHtml(u.name)}</div>
          <div style="font-size:12px;color:var(--ink-35)">${u.email}</div>
        </div>
      </div>
      <div class="field" style="margin-bottom:12px">
        <label>New Password</label>
        <input type="password" id="pwd-new" class="finput" placeholder="Min 6 characters">
      </div>
      <div class="field" style="margin-bottom:12px">
        <label>Confirm Password</label>
        <input type="password" id="pwd-confirm" class="finput" placeholder="Re-enter password">
      </div>
      <div class="login-err" id="pwd-err" style="display:none"></div>
      <div style="font-size:12px;color:var(--ink-35);margin-bottom:12px">
        Default format: <strong>${u.role.charAt(0).toUpperCase() + u.role.slice(1)}123</strong> (e.g., Teacher123, Student123, Admin123)
      </div>
      <div class="modal-footer">
        <button class="btn btn-crimson" onclick="savePasswordChange('${u.id}')">Update Password</button>
        <button class="btn btn-ghost" onclick="document.getElementById('pwd-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
        document.getElementById("pwd-new").focus();
      }

      async function savePasswordChange(userId) {
        const newPw = document.getElementById("pwd-new").value;
        const confirmPw = document.getElementById("pwd-confirm").value;
        const err = document.getElementById("pwd-err");
        const showErr = (msg) => {
          err.textContent = "⚠️ " + msg;
          err.style.display = "block";
        };

        if (!newPw || !confirmPw) {
          showErr("Please fill in both password fields.");
          return;
        }
        if (newPw.length < 6) {
          showErr("Password must be at least 6 characters.");
          return;
        }
        if (findBlacklistedWord(newPw)) {
          showErr("Password may not contain Blacklisted words.");
          return;
        }
        if (newPw !== confirmPw) {
          showErr("Passwords do not match.");
          return;
        }

        const users = dbGetList("users");
        const u = users.find((x) => x.id === userId);
        if (!u) {
          showToast("Account not found. It may have been deleted.", "err");
          document.getElementById("pwd-modal")?.remove();
          navigateTo("accounts");
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

        addAuditLogEntry("password_changed", userId, u.name, `Password changed by admin: ${currentUser.name}`);
        document.getElementById("pwd-modal").remove();
        navigateTo("accounts");
        showToast(`Password updated for ${u.name} ✓`);
      }
      function showAddAccountModal() {
        if (!currentUser || currentUser.role !== "admin") {
          showToast("Only administrators can create accounts", "err");
          return;
        }
        const depts = [
          "STEM",
          "Humanities",
          "Sciences",
          "Commerce",
          "Languages",
          "Creative Arts",
          "Technical",
          "PE & Health",
          "Support",
        ];
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "account-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-title">🔑 New Account</div>
      <div class="frow">
        <div class="ffield"><div class="flabel">Full Name</div><input class="finput" id="ac-name" placeholder="e.g. Sipho Dlamini"></div>
        <div class="ffield"><div class="flabel">Account Type</div>
          <select class="fselect" id="ac-role" onchange="toggleAccountFields()">
            <option value="student" selected>📚 Student</option>
            <option value="teacher">🎓 Teacher</option>
            <option value="parent">👨‍👩‍👧 Parent</option>
            <option value="admin">🛡 Administrator</option>
          </select>
        </div>
      </div>
      <div class="ffield" style="margin-bottom:12px"><div class="flabel">Email Address</div><input class="finput" type="email" id="ac-email" placeholder="name@yourschool.com"></div>
      <div class="frow" id="ac-student-row">
        <div class="ffield"><div class="flabel">Form</div>
          <select class="fselect" id="ac-form">
            <option>Form 1</option><option>Form 2</option><option>Form 3</option>
            <option selected>Form 4</option><option>Form 5</option><option>Form 6</option>
          </select>
        </div>
        <div class="ffield"><div class="flabel">Class</div><input class="finput" id="ac-cls" placeholder="e.g. 10B"></div>
      </div>
      <div class="frow" id="ac-dept-row" style="display:none">
        <div class="ffield"><div class="flabel">Department</div>
          <select class="fselect" id="ac-dept">${depts.map((d) => `<option>${d}</option>`).join("")}</select>
        </div>
        <div class="ffield"><div class="flabel">Subject(s)</div><input class="finput" id="ac-subj" placeholder="e.g. Mathematics"></div>
      </div>
      <div class="frow" id="ac-parent-row" style="display:none">
        <div class="ffield"><div class="flabel">Child Student ID</div>
          <select class="fselect" id="ac-child">
            ${dbGetList("users")
              .filter((u) => u.role === "student")
              .map(
                (s) =>
                  `<option value="${s.id}">${s.name} (${s.form} ${s.cls})</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="ffield"><div class="flabel">Or Child Name</div><input class="finput" id="ac-child-name" placeholder="e.g. Jane Doe"></div>
      </div>
      <div class="frow" id="ac-uid-row">
        <div class="ffield"><div class="flabel">ID Number</div><input class="finput" id="ac-uid" placeholder="e.g. 10-0001 / T-001 / A-001"></div>
        <div class="ffield"><div class="flabel">Password</div><input class="finput" type="password" id="ac-pw" placeholder="Default: role123"></div>
      </div>
      <div class="ffield" style="margin-bottom:12px">
        <div class="flabel">Confirm Password</div>
        <input class="finput" type="password" id="ac-pw2" placeholder="Re-enter password">
      </div>
      <div style="font-size:12px;color:var(--ink-35);margin-bottom:12px">
        💡 Default password is <strong>Role123</strong> (e.g., Student123, Teacher123, Admin123). Leave blank to auto-generate.
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink-60);margin:6px 0 4px" id="ac-staffsync-row">
        <input type="checkbox" id="ac-staffsync" checked> Also add to Staff Directory
      </label>
      <div class="login-err" id="account-err" style="display:none"></div>
      <div class="modal-footer">
        <button class="btn btn-crimson" onclick="saveAccount()">Create Account</button>
        <button class="btn btn-ghost" onclick="document.getElementById('account-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
        document.getElementById("ac-name").focus();
      }

      function toggleAccountFields() {
        const accRole = document.getElementById("ac-role").value;
        const isStudent = accRole === "student";
        const isTeacher = accRole === "teacher";
        document.getElementById("ac-student-row").style.display = isStudent
          ? "flex"
          : "none";
        document.getElementById("ac-dept-row").style.display = isTeacher
          ? "flex"
          : "none";
        document.getElementById("ac-parent-row").style.display =
          accRole === "parent" ? "flex" : "none";
        document.getElementById("ac-staffsync-row").style.display = isTeacher
          ? "flex"
          : "none";
        // Update default password placeholder
        const pwField = document.getElementById("ac-pw");
        if (pwField) pwField.placeholder = `Default: ${accRole}123`;
      }

      function saveAccount() {
        if (!currentUser || currentUser.role !== "admin") {
          showToast("Only administrators can create accounts", "err");
          return;
        }

        const name = document.getElementById("ac-name").value.trim();
        const email = document
          .getElementById("ac-email")
          .value.trim()
          .toLowerCase();
        const accRole = document.getElementById("ac-role").value;
        const uid = document.getElementById("ac-uid")?.value.trim() || "";
        const pw = document.getElementById("ac-pw").value;
        const pw2 = document.getElementById("ac-pw2").value;
        const err = document.getElementById("account-err");
        const showErr = (msg) => {
          err.textContent = "⚠️ " + msg;
          err.style.display = "block";
        };

        if (!name || !email) {
          showErr("Please fill in name and email.");
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

        // Auto-generate default password if blank
        const finalPw =
          pw || accRole.charAt(0).toUpperCase() + accRole.slice(1) + "123";
        if (finalPw.length < 6) {
          showErr("Password must be at least 6 characters.");
          return;
        }
        if (pw && pw !== pw2) {
          showErr("Passwords do not match.");
          return;
        }

        const users = dbGetList("users");
        if (users.some((u) => u.email.toLowerCase() === email)) {
          showErr("An account with this email already exists.");
          return;
        }

        const initials =
          name
            .split(" ")
            .map((n) => n[0])
            .filter(Boolean)
            .join("")
            .slice(0, 2)
            .toUpperCase() || "ST";
        const avColors = [
          "av1",
          "av2",
          "av3",
          "av4",
          "av5",
          "av6",
          "av7",
          "av8",
          "av9",
          "av0",
        ];
        const newUser = {
          id: dbGenId("u"),
          uid: uid || undefined,
          email,
          password: finalPw,
          role: accRole,
          name,
          initials,
          av: avColors[users.length % 10],
        };

        if (accRole === "student") {
          newUser.form = document.getElementById("ac-form")?.value || "Form 4";
          newUser.cls = document.getElementById("ac-cls")?.value.trim() || "";
        } else if (accRole === "teacher") {
          newUser.dept = document.getElementById("ac-dept")?.value || "";
        } else if (accRole === "parent") {
          newUser.childId = document.getElementById("ac-child")?.value || "";
          newUser.childName =
            document.getElementById("ac-child-name")?.value.trim() || "";
        }

        users.push(newUser);
        dbSaveList("users", users);

        // If this new student's class matches a tracked homeroom or
        // gradebook roster, add them there too — linked by ID — so they
        // show up immediately wherever that class is managed.
        if (accRole === "student" && newUser.cls) {
          moveStudentBetweenRosters(newUser.id, null, newUser.cls);
        }

        // Sync to Staff Directory for teachers
        const syncStaff = document.getElementById("ac-staffsync");
        if (accRole === "teacher" && syncStaff && syncStaff.checked) {
          const staff = dbGetList("staff");
          const subj = document.getElementById("ac-subj")?.value.trim() || "";
          staff.push({
            id: dbGenId("t"),
            name,
            subj: subj || newUser.dept,
            dept: newUser.dept,
            rm: "TBA",
            exp: 0,
            status: "active",
            av: avColors[staff.length % 10],
          });
          dbSaveList("staff", staff);
        }

        addAuditLogEntry("account_created", newUser.id, name, `Created ${accRole} account: ${name} (${email}) by ${currentUser.name}`);
        document.getElementById("account-modal").remove();
        navigateTo("accounts");
        const roleLabel =
          accRole === "admin"
            ? "Administrator"
            : accRole === "teacher"
              ? "Teacher"
              : accRole === "parent"
                ? "Parent"
                : "Student";
        showToast(
          `${roleLabel} account created for ${name} ✓ (Password: ${finalPw})`,
        );
      }

      function deleteAccount(id) {
        if (!currentUser || currentUser.role !== "admin") {
          showToast("Only administrators can manage accounts", "err");
          return;
        }
        if (id === currentUser.id) {
          showToast("You cannot delete your own account", "err");
          return;
        }
        let users = dbGetList("users");
        const u = users.find((x) => x.id === id);
        if (!u) {
          showToast("Account not found. It may have already been deleted.", "err");
          navigateTo("accounts");
          return;
        }
        const remainingAdmins = users.filter(
          (x) => x.role === "admin" && x.id !== id,
        ).length;
        if (u.role === "admin" && remainingAdmins < 1) {
          showToast("At least one administrator account must remain", "err");
          return;
        }
        if (
          !confirm(
            `Permanently delete the account for ${u.name}? This will remove all their data from the entire system and cannot be undone.`,
          )
        )
          return;
        // ── Sync Engine: cascade-delete all references to this account ──
        const delCount = cascadeDeleteAccount(id);
        if (delCount > 0) console.log("[Sync] Cascade-deleted from " + delCount + " stores");
        // Re-fetch users after cascade delete to avoid overwriting changes made by cascadeDeleteAccount
        users = dbGetList("users");
        dbSaveList(
          "users",
          users.filter((x) => x.id !== id),
        );
        addAuditLogEntry("account_deleted", id, u.name, `Account deleted: ${u.name} (${u.role}) by ${currentUser.name}`);
        navigateTo("accounts");
        showToast(`Account deleted for ${u.name}`);
      }

      // ── Suspend / Unsuspend ─────────────────────────────────────────
      function showSuspendModal(userId) {
        const reason = document.getElementById("edit-suspend-reason")?.value.trim() || "";
        if (!confirm(`Suspend this account?\n\nThe user will immediately be blocked from logging in.`)) return;
        const users = dbGetList("users");
        const u = users.find((x) => x.id === userId);
        if (!u) return;
        u.suspended = true;
        u.suspendedAt = Date.now();
        u.suspendedBy = currentUser.name;
        u.suspendedReason = reason;
        dbSaveList("users", users);
        // Also force-logout all their active sessions
        adminForceLogout(userId, u.name, /*silent=*/true);
        addAuditLogEntry("account_suspended", userId, u.name, `Account suspended by ${currentUser.name}${reason ? ": " + reason : ""}`);
        document.getElementById("edit-account-modal")?.remove();
        navigateTo("accounts");
        showToast(`${u.name}'s account has been suspended and they have been logged out.`, "warn");
      }

      function unsuspendAccount(userId) {
        const users = dbGetList("users");
        const u = users.find((x) => x.id === userId);
        if (!u) return;
        u.suspended = false;
        delete u.suspendedAt;
        delete u.suspendedBy;
        delete u.suspendedReason;
        dbSaveList("users", users);
        addAuditLogEntry("account_unsuspended", userId, u.name, `Account unsuspended by ${currentUser.name}`);
        document.getElementById("edit-account-modal")?.remove();
        navigateTo("accounts");
        showToast(`${u.name}'s account has been reinstated.`);
      }

      // ── Force Logout ────────────────────────────────────────────────
      async function adminForceLogout(userId, userName, silent = false) {
        if (!silent && !confirm(`Force logout all active sessions for ${userName}?\n\nThey will be kicked out immediately wherever they are logged in.`)) return;
        try {
          const resp = await fetch(`/api/auth/force-logout/${userId}`, {
            method: "POST",
            headers: { Authorization: "Bearer " + _sessionToken }
          });
          if (resp.ok) {
            const d = await resp.json();
            addAuditLogEntry("force_logout", userId, userName, `Force-logged out by admin ${currentUser.name} (${d.sessionsTerminated} session(s) terminated)`);
            if (!silent) {
              showToast(`${userName} has been remotely logged out (${d.sessionsTerminated} session${d.sessionsTerminated !== 1 ? "s" : ""} ended).`);
              document.getElementById("edit-account-modal")?.remove();
              navigateTo("accounts");
            }
          } else if (!silent) {
            showToast("Force logout failed — could not reach server.", "err");
          }
        } catch (e) {
          if (!silent) showToast("Force logout failed: " + e.message, "err");
        }
      }

      // ── Login History modal (for a specific user) ───────────────────
      async function showUserLoginHistory(userId, userName) {
        try {
          const resp = await fetch(`/api/auth/login-history?userId=${userId}&limit=50`, {
            headers: { Authorization: "Bearer " + _sessionToken }
          });
          const rows = resp.ok ? await resp.json() : [];
          const backdrop = document.createElement("div");
          backdrop.className = "modal-backdrop";
          backdrop.id = "login-hist-modal";
          const rowsHtml = rows.length
            ? rows.map(r => `
              <tr>
                <td style="white-space:nowrap;font-size:11px;color:var(--ink-60)">${new Date(r.logged_in_at).toLocaleString()}</td>
                <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:2px 8px;border-radius:12px;background:${r.success ? 'rgba(40,167,69,0.12)' : 'rgba(220,53,69,0.12)'};color:${r.success ? '#1a7a3a' : '#dc3545'}">${r.success ? '✅ Success' : '❌ Failed'}</span></td>
                <td style="font-size:12px;color:var(--ink-60)">${r.fail_reason || '—'}</td>
                <td style="font-size:11px;color:var(--ink-60);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.ip_address || '—'}</td>
              </tr>`).join("")
            : `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--ink-35)">No login history yet.</td></tr>`;
          backdrop.innerHTML = `
          <div class="modal" style="max-width:620px">
            <div class="modal-title">📋 Login History — ${userName}</div>
            <div style="overflow-x:auto;max-height:380px;overflow-y:auto">
              <table class="tt">
                <thead><tr><th>Time</th><th>Result</th><th>Reason</th><th>IP Address</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" onclick="document.getElementById('login-hist-modal').remove()">Close</button>
            </div>
          </div>`;
          document.body.appendChild(backdrop);
        } catch (e) {
          showToast("Could not load login history: " + e.message, "err");
        }
      }

      // ── Active Sessions admin page ──────────────────────────────────
      async function renderActiveSessions() {
        const container = document.getElementById("active-sessions-content");
        if (!container) return;
        container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--ink-35)">Loading sessions…</div>`;
        try {
          const resp = await fetch("/api/auth/sessions", {
            headers: { Authorization: "Bearer " + _sessionToken }
          });
          const rows = resp.ok ? await resp.json() : [];
          if (!rows.length) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink-35)">No active sessions right now.</div>`;
            return;
          }
          container.innerHTML = `
          <div style="overflow-x:auto">
            <table class="tt">
              <thead><tr><th>User</th><th>Role</th><th>IP</th><th>Started</th><th>Expires</th><th>Actions</th></tr></thead>
              <tbody>
                ${rows.map(s => `
                <tr>
                  <td>
                    <div style="font-weight:600;font-size:13px">${s.user_name}</div>
                    <div style="font-size:11px;color:var(--ink-60)">${s.user_email}</div>
                  </td>
                  <td><span class="u-role ${s.user_role === 'admin' ? 'u-role-a' : s.user_role === 'teacher' ? 'u-role-t' : s.user_role === 'student' ? 'u-role-s' : 'u-role-p'}" style="font-size:10px">${s.user_role}</span></td>
                  <td style="font-size:12px;color:var(--ink-60)">${s.ip_address || '—'}</td>
                  <td style="font-size:11px;color:var(--ink-60);white-space:nowrap">${new Date(s.created_at).toLocaleString()}</td>
                  <td style="font-size:11px;color:var(--ink-60);white-space:nowrap">${new Date(s.expires_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
                  <td>
                    ${s.user_id !== currentUser.id
                      ? `<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;color:var(--crimson);border-color:var(--crimson)" onclick="adminForceLogout('${s.user_id}','${s.user_name}').then(()=>renderActiveSessions())">⏏ Kick</button>`
                      : `<span style="font-size:11px;color:var(--ink-35)">You</span>`}
                  </td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>`;
        } catch (e) {
          container.innerHTML = `<div style="text-align:center;padding:30px;color:#dc3545">Error: ${escapeHtml(e.message)}</div>`;
        }
      }

      // ── Admin: Login History full page ──────────────────────────────
      async function renderAdminLoginHistory() {
        const container = document.getElementById("all-login-hist-content");
        if (!container) return;
        container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--ink-35)">Loading…</div>`;
        try {
          const resp = await fetch("/api/auth/login-history?limit=200", {
            headers: { Authorization: "Bearer " + _sessionToken }
          });
          const rows = resp.ok ? await resp.json() : [];
          if (!rows.length) {
            container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink-35)">No login history yet.</div>`;
            return;
          }
          container.innerHTML = `
          <div style="overflow-x:auto;max-height:500px;overflow-y:auto">
            <table class="tt">
              <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Result</th><th>Reason</th><th>IP</th></tr></thead>
              <tbody>
                ${rows.map(r => `
                <tr>
                  <td style="font-size:11px;white-space:nowrap;color:var(--ink-60)">${new Date(r.logged_in_at).toLocaleString()}</td>
                  <td>
                    <div style="font-weight:600;font-size:12px">${r.user_name || '<span style="color:var(--ink-35)">Unknown</span>'}</div>
                    <div style="font-size:11px;color:var(--ink-60)">${r.user_email || ''}</div>
                  </td>
                  <td style="font-size:12px;color:var(--ink-60)">${r.user_role || '—'}</td>
                  <td><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:${r.success ? 'rgba(40,167,69,0.12)' : 'rgba(220,53,69,0.12)'};color:${r.success ? '#1a7a3a' : '#dc3545'}">${r.success ? '✅ In' : '❌ Fail'}</span></td>
                  <td style="font-size:12px;color:var(--ink-60)">${r.fail_reason || '—'}</td>
                  <td style="font-size:11px;color:var(--ink-60)">${r.ip_address || '—'}</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>`;
        } catch (e) {
          container.innerHTML = `<div style="padding:30px;color:#dc3545">Error: ${escapeHtml(e.message)}</div>`;
        }
      }


