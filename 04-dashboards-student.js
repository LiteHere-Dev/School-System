      // ══════════════════════════════════════════════════════
      // ─── REPORT CARD — shared grading helpers ─────────────
      // ══════════════════════════════════════════════════════
      // IGCSE A*–G Grading (Cambridge standard)
      function rcSymbol(mark) {
        if (mark === null || mark === undefined || mark === "") return null;
        const m = Number(mark);
        if (m >= 90) return "A*";
        if (m >= 80) return "A";
        if (m >= 70) return "B";
        if (m >= 60) return "C";
        if (m >= 50) return "D";
        if (m >= 40) return "E";
        if (m >= 30) return "F";
        if (m >= 20) return "G";
        return "U";
      }
      function rcRemark(symbol) {
        const map = {
          "A*": "Exceptional — Outstanding achievement",
          A: "Excellent — Strong understanding",
          B: "Very Good — Above average",
          C: "Good — Competent performance",
          D: "Satisfactory — Partial understanding",
          E: "Sufficient — Limited grasp",
          F: "Low — Weak performance",
          G: "Very Low — Minimal understanding",
          U: "Ungraded — Below threshold",
        };
        return map[symbol] || "—";
      }
      function rcColor(symbol) {
        const map = {
          "A*": "var(--gold)",
          A: "#3A7A5C",
          B: "var(--navy-mid)",
          C: "var(--crimson-soft)",
          D: "#7A4080",
          E: "#A0522D",
          F: "var(--crimson)",
          G: "#8B4513",
          U: "var(--ink-35)",
        };
        return map[symbol] || "var(--ink-35)";
      }

      // ─── GRADEBOOK → REPORT CARD INTEGRATION ─────────────────────────
      function computeGradebookAverage(studentId, gradebookClassId) {
        const roster = dbGetList("gradebook_" + gradebookClassId);
        if (!roster || !roster.length) return null;
        let studentEntry = roster.find((s) => s.userId === studentId);
        if (!studentEntry) {
          // Fallback for legacy rows seeded before ID-based linking existed.
          const user = dbGetList("users").find((u) => u.id === studentId);
          if (user) {
            studentEntry = roster.find(
              (s) => !s.userId && s.name === user.name,
            );
          }
        }
        if (
          !studentEntry ||
          !studentEntry.scores ||
          !studentEntry.scores.length
        )
          return null;
        const avg = Math.round(
          studentEntry.scores.reduce((a, b) => a + b, 0) /
            studentEntry.scores.length,
        );
        return avg;
      }
      function getReportCardMark(studentId, rcEntry) {
        if (!rcEntry) return { mark: null, source: "pending" };
        if (
          rcEntry.mark !== null &&
          rcEntry.mark !== undefined &&
          rcEntry.mark !== ""
        ) {
          return { mark: rcEntry.mark, source: "teacher" };
        }
        if (rcEntry.gbClass) {
          const computed = computeGradebookAverage(studentId, rcEntry.gbClass);
          if (computed !== null) return { mark: computed, source: "gradebook" };
        }
        return { mark: null, source: "pending" };
      }
      function buildReportCard(studentId) {
        const rcData = dbGetList("report_card_" + studentId);
        if (!rcData || !rcData.length) return [];
        return rcData.map((entry) => {
          const result = getReportCardMark(studentId, entry);
          return { ...entry, displayMark: result.mark, source: result.source };
        });
      }

      function studentReportCard() {
        const subjects = buildReportCard(currentUser.id);
        if (!subjects.length) {
          return `<div class="inner">
    <button class="btn btn-ghost" style="margin-bottom:18px;font-size:12px" onclick="hideStudentReportCard()">← My Grades</button>
    <div class="ph"><h2>Report <em>Card</em></h2><p>${escapeHtml(currentUser.form || "")} ${currentUser.cls ? "· " + escapeHtml(currentUser.cls) : ""} · Term 2, 2026 — ${escapeHtml(currentUser.name)}</p></div>
    <div class="card" style="text-align:center;padding:40px;color:var(--ink-35)">No report card has been issued for you yet. Please check with the school office.</div>
  </div>`;
        }
        const completed = subjects.filter((s) => s.displayMark !== null);
        const avg = completed.length
          ? Math.round(
              completed.reduce((a, b) => a + Number(b.displayMark), 0) /
                completed.length,
            )
          : null;
        const avgSymbol = avg !== null ? rcSymbol(avg) : null;
        return `<div class="inner">
    <button class="btn btn-ghost" style="margin-bottom:18px;font-size:12px" onclick="hideStudentReportCard()">← My Grades</button>
    <div class="ph"><h2>Report <em>Card</em></h2><p>${escapeHtml(currentUser.form)} · ${escapeHtml(currentUser.cls)} · Term 2, 2026 — ${escapeHtml(currentUser.name)}</p></div>
    <div class="g2">
      ${subjects
        .map((s) => {
          const pending = s.displayMark === null;
          const symbol = pending ? null : rcSymbol(s.displayMark);
          const remark = pending ? null : rcRemark(symbol);
          const color = pending ? "var(--ink-35)" : rcColor(symbol);
          const sourceBadge = pending
            ? `<span class="source-badge source-pending">⏳ Pending</span>`
            : s.source === "gradebook"
              ? `<span class="source-badge source-gb">📊 From Gradebook</span>`
              : `<span class="source-badge source-teacher">✏️ Teacher Entered</span>`;
          return `<div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:10px;flex-wrap:wrap">
            <div>
              <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:var(--navy)">${escapeHtml(s.subject)}</div>
              <div style="font-size:12px;color:var(--ink-35);margin-top:3px">${s.teacherName}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">${sourceBadge}${pending ? "" : `<div style="font-family:'Playfair Display',serif;font-size:30px;font-weight:900;color:${color}">${symbol}</div>`}</div>
          </div>
          ${pending ? `<div style="font-size:12px;color:var(--ink-35)">Awaiting marks from ${s.teacherName}</div>` : `<div class="pbar"><div class="pfill" style="width:${s.displayMark}%;background:${color}"></div></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span style="font-size:12px;color:var(--ink-35)">${s.displayMark} / 100</span><span style="font-size:12px;font-weight:600;color:${color}">${remark}</span></div>`}
        </div>`;
        })
        .join("")}
    </div>
    <div class="card" style="margin-top:20px;text-align:center;padding:20px">
      <div style="font-size:12px;color:var(--ink-60);text-transform:uppercase;letter-spacing:0.07em;font-weight:600;margin-bottom:8px">Overall Average${completed.length < subjects.length ? ` · ${completed.length}/${subjects.length} subjects recorded` : ""}</div>
      <div style="font-family:'Playfair Display',serif;font-size:48px;font-weight:900;color:var(--navy)">${avg !== null ? avg + "%" : "—"}</div>
      ${avgSymbol ? `<div style="font-size:16px;font-weight:600;color:${rcColor(avgSymbol)};margin-top:4px">${avgSymbol} · ${rcRemark(avgSymbol)}</div>` : ""}
    </div>
  </div>`;
      }

      // ══════════════════════════════════════════════════════
      // ══════════════════════════════════════════════════════
      const FORUM_CATS = [
        {
          name: "General Discussion",
          icon: "💬",
          bg: "var(--crimson-pale)",
          desc: "School life, events & general chatter",
        },
        {
          name: "Mathematics Help",
          icon: "📐",
          bg: "var(--navy-pale)",
          desc: "Algebra, trigonometry, statistics & problem solving",
        },
        {
          name: "Computer Science & ICT",
          icon: "💻",
          bg: "rgba(58,122,92,0.08)",
          desc: "Python, databases, networking & digital literacy",
        },
        {
          name: "IGCSE Exam Prep",
          icon: "🎓",
          bg: "var(--gold-pale)",
          desc: "Past papers, revision tips & mock exam discussion",
        },
      ];

      // ─── Forum compose / moderation state ─────────────────
      let forumReplyTarget = null; // { threadId, replyId, authorName }
      let forumEditingThreadId = null;
      let forumEditingReplyId = null;

      // Builds <option> list of every account so a post can be made
      // "as" any user on the system, not just whoever is logged in.
      function forumAuthorOptions() {
        return dbGetList("users")
          .map(
            (u) =>
              `<option value="${escapeHtml(u.name)}">${escapeHtml(u.role)}</option>`,
          )
          .join("");
      }

      // Looks up the typed "post as" value against the accounts table.
      // Falls back to the name typed (custom/free-text author) and,
      // if left blank, to whoever is currently logged in.
      function resolveForumIdentity(inputId) {
        const el = document.getElementById(inputId);
        const val = el ? el.value.trim() : "";
        if (!val) {
          return { author: currentUser.name, authorId: currentUser.id, av: currentUser.av };
        }
        const match = dbGetList("users").find(
          (u) => u.name.toLowerCase() === val.toLowerCase(),
        );
        if (match) return { author: match.name, authorId: match.id, av: match.av };
        return { author: val, authorId: null, av: currentUser.av };
      }

      // Admins can moderate every post; everyone else can only
      // edit/delete content that they personally posted (tracked via
      // postedBy, independent of which account it was posted "as").
      function canModForumPost(post) {
        if (!currentUser) return false;
        if (currentUser.role === "admin") return true;
        const ownerId = post.postedBy || post.authorId;
        return !!ownerId && ownerId === currentUser.id;
      }

      function forumInitials(name) {
        return (name || "")
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2);
      }

      function forums() {
        const threads = dbGetList("forum_threads");
        return `<div class="inner">
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2>Student <em>Forums</em></h2><p>Discuss, collaborate and get help from your classmates</p></div>
      <button class="btn btn-crimson" onclick="toggleForm('nf')">+ New Thread</button>
    </div>

    <datalist id="forum-acct-list">${forumAuthorOptions()}</datalist>

    <div id="nf" style="display:none;margin-bottom:24px">
      <div class="card">
        <div class="card-title">✏️ Start a Discussion</div>
        <div class="frow">
          <div class="ffield"><div class="flabel">Title</div><input class="finput" id="ft-title" placeholder="e.g. Help with trigonometry identities"></div>
          <div class="ffield"><div class="flabel">Category</div>
            <select class="fselect" id="ft-cat">
              ${FORUM_CATS.map((c) => `<option>${escapeHtml(c.name)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="ffield" style="margin-bottom:14px"><div class="flabel">Your message</div><textarea class="ftextarea" id="ft-body" placeholder="Share your question or thoughts…"></textarea></div>
        <div class="ffield" style="margin-bottom:14px">
          <div class="flabel">Post as</div>
          <input class="finput" id="ft-author" list="forum-acct-list" value="${escapeHtml(currentUser.name)}" placeholder="Search for a student, teacher or staff account…">
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-crimson" onclick="postThread()">Post Thread</button>
          <button class="btn btn-ghost" onclick="toggleForm('nf')">Cancel</button>
        </div>
      </div>
    </div>

    ${FORUM_CATS.map((cat) => {
      const catThreads = threads.filter((t) => t.cat === cat.name);
      return `
        <div class="forum-cat">
          <div class="forum-cat-head">
            <div class="fcat-icon" style="background:${cat.bg}">${cat.icon}</div>
            <div>
              <div class="fcat-name">${escapeHtml(cat.name)}</div>
              <div class="fcat-desc">${escapeHtml(cat.desc)}</div>
            </div>
            <div style="margin-left:auto;font-size:12px;color:var(--ink-35)">${catThreads.length} thread${catThreads.length !== 1 ? "s" : ""}</div>
          </div>
          ${catThreads.length === 0 ? `<div style="padding:20px;text-align:center;color:var(--ink-35);font-size:13px">No threads yet — be the first to post!</div>` : ""}
          ${catThreads
            .map(
              (t) => `
            <div class="fthread" onclick="viewThread('${t.id}')">
              <div class="unread-dot" style="opacity:${Date.now() - t.time < 300000 ? 1 : 0.3}"></div>
              <div class="ft-av ${t.av}">${forumInitials(t.author)}</div>
              <div style="flex:1;min-width:0">
                <div class="ft-title bold">${escapeHtml(t.title)}</div>
                <div class="ft-meta">${escapeHtml(t.author)} · ${timeAgo(t.time)}${t.edited ? ` · <span class="fedited-tag">edited</span>` : ""}</div>
              </div>
              <div class="ft-stats"><span>💬 ${t.replies.length}</span><span>👁 ${t.views}</span></div>
            </div>`,
            )
            .join("")}
        </div>`;
    }).join("")}
  </div>`;
      }

      function postThread() {
        const title = document.getElementById("ft-title").value.trim();
        const cat = document.getElementById("ft-cat").value;
        const body = document.getElementById("ft-body").value.trim();
        if (!title || !body) {
          showToast("Please fill in both title and message", "err");
          return;
        }
        const blTitle = findBlacklistedWord(title);
        const blBody = findBlacklistedWord(body);
        if (blTitle || blBody) {
          showToast(`Cannot post — content contains a blacklisted word ("${blTitle || blBody}")`, "err");
          recordBlacklistBlock(blTitle || blBody, "thread_blocked", blTitle ? title : body, title);
          return;
        }
        const identity = resolveForumIdentity("ft-author");
        const threads = dbGetList("forum_threads");
        threads.unshift({
          id: dbGenId("ft"),
          cat,
          title,
          author: identity.author,
          authorId: identity.authorId,
          av: identity.av,
          postedBy: currentUser.id,
          time: Date.now(),
          body,
          replies: [],
          views: 0,
          edited: false,
        });
        dbSaveList("forum_threads", threads);
        navigateTo("forums");
        showToast("Thread posted ✓");
      }

      function editThreadStart(id) {
        forumEditingThreadId = id;
        viewThread(id, true);
      }
      function editThreadCancel(id) {
        forumEditingThreadId = null;
        viewThread(id, true);
      }
      function saveThreadEdit(id) {
        const title = document.getElementById("et-title").value.trim();
        const body = document.getElementById("et-body").value.trim();
        if (!title || !body) {
          showToast("Please fill in both title and message", "err");
          return;
        }
        const blEditTitle = findBlacklistedWord(title);
        const blEditBody = findBlacklistedWord(body);
        if (blEditTitle || blEditBody) {
          showToast(`Cannot save — content contains a blacklisted word ("${blEditTitle || blEditBody}")`, "err");
          recordBlacklistBlock(blEditTitle || blEditBody, "thread_edit_blocked", blEditTitle ? title : body, title);
          return;
        }
        const threads = dbGetList("forum_threads");
        const t = threads.find((th) => th.id === id);
        if (!t) return;
        t.title = title;
        t.body = body;
        t.edited = true;
        dbSaveList("forum_threads", threads);
        forumEditingThreadId = null;
        viewThread(id, true);
        showToast("Thread updated ✓");
      }
      function deleteThread(id) {
        if (!confirm("Delete this thread? This cannot be undone.")) return;
        let threads = dbGetList("forum_threads");
        threads = threads.filter((th) => th.id !== id);
        dbSaveList("forum_threads", threads);
        forumReplyTarget = null;
        forumEditingThreadId = null;
        forumEditingReplyId = null;
        navigateTo("forums");
        showToast("Thread deleted");
      }

      function startReplyTo(threadId, replyId) {
        const t = dbGetList("forum_threads").find((th) => th.id === threadId);
        const r = t && t.replies.find((rp) => rp.id === replyId);
        if (!r) return;
        forumReplyTarget = { threadId, replyId, authorName: r.author };
        viewThread(threadId, true);
        const box = document.getElementById("reply-text");
        if (box) box.focus();
      }
      function cancelReplyTarget(threadId) {
        forumReplyTarget = null;
        viewThread(threadId, true);
      }

      function editReplyStart(threadId, replyId) {
        forumEditingReplyId = replyId;
        viewThread(threadId, true);
      }
      function cancelReplyEdit(threadId) {
        forumEditingReplyId = null;
        viewThread(threadId, true);
      }
      function saveReplyEdit(threadId, replyId) {
        const box = document.getElementById(`er-text-${replyId}`);
        const text = box ? box.value.trim() : "";
        if (!text) {
          showToast("Reply can't be empty", "err");
          return;
        }
        const blReplyEdit = findBlacklistedWord(text);
        if (blReplyEdit) {
          showToast(`Cannot save — contains a blacklisted word ("${blReplyEdit}")`, "err");
          const editThreads = dbGetList("forum_threads");
          const editThread = editThreads.find((th) => th.id === threadId);
          recordBlacklistBlock(blReplyEdit, "reply_edit_blocked", text, editThread ? editThread.title : "");
          return;
        }
        const threads = dbGetList("forum_threads");
        const t = threads.find((th) => th.id === threadId);
        if (!t) return;
        const r = t.replies.find((rp) => rp.id === replyId);
        if (!r) return;
        r.text = text;
        r.edited = true;
        dbSaveList("forum_threads", threads);
        forumEditingReplyId = null;
        viewThread(threadId, true);
        showToast("Reply updated ✓");
      }
      function deleteReply(threadId, replyId) {
        if (!confirm("Delete this reply? This cannot be undone.")) return;
        const threads = dbGetList("forum_threads");
        const t = threads.find((th) => th.id === threadId);
        if (!t) return;
        t.replies = t.replies.filter((rp) => rp.id !== replyId);
        // any replies nested under the one just deleted become top-level
        t.replies.forEach((rp) => {
          if (rp.replyToId === replyId) rp.replyToId = null;
        });
        if (forumReplyTarget && forumReplyTarget.replyId === replyId) {
          forumReplyTarget = null;
        }
        if (forumEditingReplyId === replyId) forumEditingReplyId = null;
        dbSaveList("forum_threads", threads);
        viewThread(threadId, true);
        showToast("Reply deleted");
      }

      function viewThread(id, isRerender) {
        const threads = dbGetList("forum_threads");
        const t = threads.find((th) => th.id === id);
        if (!t) return;
        if (!isRerender) {
          // fresh entry into the thread — bump views & clear any
          // leftover compose/edit state from a previously viewed thread
          t.views++;
          dbSaveList("forum_threads", threads);
          forumReplyTarget = null;
          forumEditingThreadId = null;
          forumEditingReplyId = null;
        }

        const isEditingThread = forumEditingThreadId === t.id;
        const canModThread = canModForumPost(t);

        const page = document.getElementById("page-forums");
        page.innerHTML = `<div class="inner">
    <div style="margin-bottom:20px">
      <button class="btn btn-ghost" style="font-size:12px" onclick="navigateTo('forums')">← Back to Forums</button>
    </div>
    <datalist id="forum-acct-list">${forumAuthorOptions()}</datalist>
    <div class="card" style="margin-bottom:20px">
      ${
        isEditingThread
          ? `
        <div class="ffield" style="margin-bottom:12px"><div class="flabel">Title</div><input class="finput" id="et-title" value="${escapeHtml(t.title)}"></div>
        <div class="ffield" style="margin-bottom:14px"><div class="flabel">Message</div><textarea class="ftextarea" id="et-body">${escapeHtml(t.body || "")}</textarea></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-crimson" onclick="saveThreadEdit('${t.id}')">Save Changes</button>
          <button class="btn btn-ghost" onclick="editThreadCancel('${t.id}')">Cancel</button>
        </div>`
          : `
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
        <div class="ft-av ${t.av}" style="width:38px;height:38px;font-size:14px">${forumInitials(t.author)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:var(--navy);line-height:1.2">${escapeHtml(t.title)}</div>
          <div style="font-size:12px;color:var(--ink-35);margin-top:4px">${escapeHtml(t.author)} · ${timeAgo(t.time)} · ${t.cat}${t.edited ? ` · <span class="fedited-tag">edited</span>` : ""}</div>
        </div>
        ${
          canModThread
            ? `<div class="freply-actions" style="margin-top:2px">
                <button class="freply-action-btn" data-no-translate onclick="editThreadStart('${t.id}')">✏️ Edit</button>
                <button class="freply-action-btn danger" onclick="deleteThread('${t.id}')">🗑 Delete</button>
              </div>`
            : ""
        }
      </div>
      ${t.body ? `<div style="font-size:14px;line-height:1.6;color:var(--ink);padding:14px;background:var(--ivory);border-radius:8px"><span class="translatable-content">${escapeHtml(t.body)}</span></div>` : ""}`
      }
    </div>

    <div style="font-size:13px;font-weight:600;color:var(--ink-60);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:14px">${t.replies.length} ${t.replies.length === 1 ? "Reply" : "Replies"}</div>
    <div id="replies-list">
      ${t.replies
        .map((r) => {
          const isEditingReply = forumEditingReplyId === r.id;
          const canModReply = canModForumPost(r);
          const parent = r.replyToId
            ? t.replies.find((p) => p.id === r.replyToId)
            : null;
          return `
        <div class="thread-reply${parent ? " freply-nested" : ""}">
          ${parent ? `<div class="freply-context">↳ Replying to ${escapeHtml(parent.author)}</div>` : ""}
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div class="ft-av ${r.av}" style="width:28px;height:28px;font-size:10px">${forumInitials(r.author)}</div>
            <span class="thread-reply-author">${escapeHtml(r.author)}</span>
            <span style="font-size:11px;color:var(--ink-35)">${timeAgo(r.time)}</span>
            ${r.edited ? `<span class="fedited-tag">edited</span>` : ""}
          </div>
          ${
            isEditingReply
              ? `
          <textarea class="ftextarea" id="er-text-${r.id}" style="min-height:70px">${escapeHtml(r.text)}</textarea>
          <div class="freply-actions" style="margin-top:8px">
            <button class="freply-action-btn" style="color:var(--crimson)" onclick="saveReplyEdit('${t.id}','${r.id}')">Save</button>
            <button class="freply-action-btn" onclick="cancelReplyEdit('${t.id}')">Cancel</button>
          </div>`
              : `
          <div class="thread-reply-text"><span class="translatable-content">${escapeHtml(r.text)}</span></div>
          <div class="freply-actions">
            <button class="freply-action-btn" onclick="startReplyTo('${t.id}','${r.id}')">↩ Reply</button>
            ${
              canModReply
                ? `<button class="freply-action-btn" data-no-translate onclick="editReplyStart('${t.id}','${r.id}')">✏️ Edit</button>
                   <button class="freply-action-btn danger" onclick="deleteReply('${t.id}','${r.id}')">🗑 Delete</button>`
                : ""
            }
          </div>`
          }
        </div>`;
        })
        .join("")}
    </div>

    <div class="card" style="margin-top:20px">
      <div class="card-title" style="margin-bottom:12px">💬 Post a Reply</div>
      ${
        forumReplyTarget && forumReplyTarget.threadId === t.id
          ? `<div class="freply-target-banner">
              <span>Replying to <strong>${escapeHtml(forumReplyTarget.authorName)}</strong></span>
              <button class="freply-action-btn" onclick="cancelReplyTarget('${t.id}')">✕ Cancel</button>
            </div>`
          : ""
      }
      <textarea class="ftextarea" id="reply-text" placeholder="Write your reply…"></textarea>
      <div class="ffield" style="margin-top:12px;margin-bottom:4px">
        <div class="flabel">Post as</div>
        <input class="finput" id="reply-author" list="forum-acct-list" value="${escapeHtml(currentUser.name)}" placeholder="Search for a student, teacher or staff account…">
      </div>
      <button class="btn btn-crimson" style="margin-top:10px" onclick="postReply('${t.id}')">Post Reply</button>
    </div>
  </div>`;
        // Translate any user-entered content if non-English lang is active
        applyContentTranslations();
      }

      function postReply(threadId) {
        const box = document.getElementById("reply-text");
        const text = box ? box.value.trim() : "";
        if (!text) return;
        const blReply = findBlacklistedWord(text);
        if (blReply) {
          showToast(`Cannot post reply — contains a blacklisted word ("${blReply}")`, "err");
          const replyThreads = dbGetList("forum_threads");
          const replyThread = replyThreads.find((th) => th.id === threadId);
          recordBlacklistBlock(blReply, "reply_blocked", text, replyThread ? replyThread.title : "");
          return;
        }
        const threads = dbGetList("forum_threads");
        const t = threads.find((th) => th.id === threadId);
        if (!t) return;
        const identity = resolveForumIdentity("reply-author");
        const replyToId =
          forumReplyTarget && forumReplyTarget.threadId === threadId
            ? forumReplyTarget.replyId
            : null;
        t.replies.push({
          id: dbGenId("fr"),
          author: identity.author,
          authorId: identity.authorId,
          av: identity.av,
          postedBy: currentUser.id,
          text,
          time: Date.now(),
          replyToId,
          edited: false,
        });
        dbSaveList("forum_threads", threads);
        forumReplyTarget = null;
        viewThread(threadId, true);
        showToast("Reply posted ✓");
      }

      // ══════════════════════════════════════════════════════
      // ─── CLASS DIRECTORY (Teacher & Admin) ────────────────
      // ══════════════════════════════════════════════════════
      let currentHomeroomClass = null;

      function renderClassesPage() {
        const el = document.getElementById("page-classes");
        if (el) el.innerHTML = renderPage("classes");
      }

      function openHomeroom(classId) {
        currentHomeroomClass = classId;
        renderClassesPage();
      }

      function backToClasses() {
        currentHomeroomClass = null;
        renderClassesPage();
      }

      function classDirectory() {
        const homerooms = dbGetList("homerooms");
        const order = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Sixth Form"];
        const groups = order
          .map((grade) => ({
            name: grade,
            items: homerooms.filter((h) => h.grade === grade),
          }))
          .filter((g) => g.items.length);
        const totalStudents = homerooms.reduce(
          (sum, h) => sum + dbGetList("homeroom_" + h.id).length,
          0,
        );
        const assignments = dbGetList("assignments").filter(
          (a) => role !== "teacher" || a.teacherId === currentUser.id,
        );
        const anns = dbGetList("announcements").filter((a) => !a.classId);
        return `<div class="inner">
    <div class="ph">
      <h2>School <em>Classes</em></h2>
      <p>Full directory of homeroom classes — Grade 8 through Grade 11, plus the Sixth Form. Click a class to view its students.</p>
    </div>
    <div class="g4" style="margin-bottom:22px">
      <div class="stat cr"><div class="stat-icon">🏫</div><div class="stat-num">${homerooms.length}</div><div class="stat-label">Homeroom Classes</div></div>
      <div class="stat nv"><div class="stat-icon">👩‍🎓</div><div class="stat-num">${totalStudents}</div><div class="stat-label">Total Students</div></div>
      <div class="stat gd"><div class="stat-icon">📝</div><div class="stat-num">${assignments.length}</div><div class="stat-label">${role === "teacher" ? "My Active Tasks" : "Active Tasks"}</div></div>
      <div class="stat gr"><div class="stat-icon">📢</div><div class="stat-num">${anns.length}</div><div class="stat-label">Announcements</div></div>
    </div>
    <div class="g2" style="margin-bottom:22px">
      <div class="card">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          📢 Announcements
          ${role === "admin" || role === "teacher" ? `<button class="btn btn-crimson" style="font-size:11px;padding:6px 12px" onclick="showAddAnnouncement()">+ Post</button>` : ""}
        </div>
        ${anns.length ? renderAnnouncements(3, role === "admin" || role === "teacher") : `<p style="font-size:13px;color:var(--ink-35)">No announcements posted yet.</p>`}
      </div>
      <div class="card">
        <div class="card-title">📅 Active Tasks</div>
        ${
          assignments.length
            ? assignments
                .slice(0, 4)
                .map(
                  (a) => `
          <div class="list-item">
            <div class="li-dot dc"></div>
            <div class="li-main">
              <div class="li-title">${escapeHtml(a.title)}</div>
              <div class="li-sub">${escapeHtml(a.cls)} · Due ${a.due}</div>
              <div style="margin-top:5px;display:flex;align-items:center;gap:8px">
                <div class="pbar" style="width:100px"><div class="pfill" style="width:${Math.round((a.submitted / a.total) * 100)}%;background:var(--crimson)"></div></div>
                <span style="font-size:11px;color:var(--ink-35)">${a.submitted}/${a.total}</span>
              </div>
            </div>
            <div class="li-aside">${a.due}</div>
          </div>`,
                )
                .join("")
            : `<p style="font-size:13px;color:var(--ink-35)">No active tasks right now.</p>`
        }
      </div>
    </div>
    ${groups
      .map(
        (g) => `
      <div class="class-group">
        <div class="class-group-head"><h3>${escapeHtml(g.name)}</h3><span>${g.items.length} homeroom class${g.items.length !== 1 ? "es" : ""}</span></div>
        <div class="class-tile-grid">
          ${g.items
            .map((h) => {
              const count = dbGetList("homeroom_" + h.id).length;
              return `
            <div class="class-tile${h.sixth ? " ct-sixth" : ""}" style="cursor:pointer" onclick="openHomeroom('${h.id}')">
              <div class="ct-code">${escapeHtml(h.label)}</div>
              <div class="ct-tag">${count} student${count !== 1 ? "s" : ""}</div>
            </div>`;
            })
            .join("")}
        </div>
      </div>`,
      )
      .join("")}
  </div>`;
      }

      function homeroomRosterView(classId) {
        const cls = dbGetList("homerooms").find((h) => h.id === classId);
        if (!cls) {
          currentHomeroomClass = null;
          return classDirectory();
        }
        const students = dbGetList("homeroom_" + classId);
        const classAnns = dbGetList("announcements").filter(
          (a) => a.classId === classId,
        );
        return `<div class="inner">
    <button class="btn btn-ghost" style="margin-bottom:18px;font-size:12px" onclick="backToClasses()">← All Classes</button>
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2>${escapeHtml(cls.label)} <em>Homeroom</em></h2><p>${escapeHtml(cls.grade)} · ${students.length} students</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-navy" onclick="showAddHomeroomStudent()">+ Add Student</button>
      </div>
    </div>
    <div class="g2" style="margin-bottom:22px">
      <div class="card">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          📢 ${escapeHtml(cls.label)} Announcements
          <button class="btn btn-crimson" style="font-size:11px;padding:6px 12px" onclick="showAddAnnouncement('${cls.id}')">+ Post</button>
        </div>
        ${classAnns.length ? renderAnnouncements(5, true, cls.id) : `<p style="font-size:13px;color:var(--ink-35)">No announcements posted for this class yet. Use “+ Post” to notify students in ${cls.label} only.</p>`}
      </div>
      <div class="card">
        <div class="card-title">👥 Class Snapshot</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:14px">
          <span style="font-size:13px;color:var(--ink-60)">Grade</span>
          <span style="font-size:13px;font-weight:600;color:var(--ink)">${cls.grade}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:14px">
          <span style="font-size:13px;color:var(--ink-60)">Students</span>
          <span style="font-size:13px;font-weight:600;color:var(--ink)">${students.length}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:13px;color:var(--ink-60)">Class Announcements</span>
          <span style="font-size:13px;font-weight:600;color:var(--ink)">${classAnns.length}</span>
        </div>
      </div>
    </div>
    <div class="card">
      <div style="overflow-x:auto">
        <table class="tt" id="homeroom-table">
          <thead><tr><th>#</th><th>Student</th><th>Student ID</th><th></th></tr></thead>
          <tbody id="homeroom-tbody">${renderHomeroomRows(classId)}</tbody>
        </table>
      </div>
    </div>
  </div>`;
      }

      function renderHomeroomRows(classId) {
        const students = dbGetList("homeroom_" + classId);
        const usersById = usersByIdMap();
        return students
          .map((s, i) => {
            const d = resolveStudent(s, usersById);
            return `
    <tr>
      <td style="color:var(--ink-35);font-weight:600">${i + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="ft-av ${d.av}" style="width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--ink);flex-shrink:0">${escapeHtml(d.init)}</span>
          <span style="font-weight:500">${escapeHtml(d.name)}</span>
        </div>
      </td>
      <td style="color:var(--ink-60)">${escapeHtml(d.uid)}</td>
      <td><button class="btn btn-danger" style="padding:5px 10px;font-size:11px" onclick="removeHomeroomStudent('${s.id}')">Remove</button></td>
    </tr>`;
          })
          .join("");
      }

      function showAddHomeroomStudent() {
        const cls = dbGetList("homerooms").find(
          (h) => h.id === currentHomeroomClass,
        );
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "homeroom-student-modal";
        backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-title">+ Add Student${cls ? " — " + cls.label : ""}</div>
      <div class="ffield" style="margin-bottom:12px"><div class="flabel">Full Name</div><input class="finput" id="hr-st-name" placeholder="e.g. Sipho Dlamini"></div>
      <div class="modal-footer">
        <button class="btn btn-crimson" onclick="saveHomeroomStudent()">Add to Class</button>
        <button class="btn btn-ghost" onclick="document.getElementById('homeroom-student-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
      }

      function saveHomeroomStudent() {
        const name = document.getElementById("hr-st-name").value.trim();
        if (!name) {
          showToast("Please enter a name", "err");
          return;
        }
        if (!isValidName(name)) {
          showToast("Name may only contain letters, spaces, hyphens, and apostrophes.", "err");
          return;
        }
        const key = "homeroom_" + currentHomeroomClass;
        const students = dbGetList(key);
        const parts = name.split(" ").filter(Boolean);
        const initials =
          parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase();
        const newEntry = {
          id: dbGenId("hs"),
          uid:
            currentHomeroomClass +
            "-" +
            String(students.length + 1).padStart(3, "0"),
          name,
          init: initials,
          av: HR_AVATARS[students.length % HR_AVATARS.length],
        };
        // If a registered account already exists for this student in this
        // class, link the new row to it by ID instead of leaving it as a
        // disconnected duplicate.
        const match = dbGetList("users").find(
          (u) =>
            u.role === "student" &&
            u.cls === currentHomeroomClass &&
            u.name === name,
        );
        if (match) {
          newEntry.userId = match.id;
          newEntry.uid = match.uid || newEntry.uid;
          newEntry.init = match.initials;
          newEntry.av = match.av;
        }
        students.push(newEntry);
        dbSaveList(key, students);
        document.getElementById("homeroom-student-modal").remove();
        renderClassesPage();
        showToast(`${name} added to ${currentHomeroomClass} ✓`);
      }

      function removeHomeroomStudent(id) {
        const key = "homeroom_" + currentHomeroomClass;
        let students = dbGetList(key);
        const s = students.find((st) => st.id === id);
        if (!s) return;
        const d = resolveStudent(s);
        if (!confirm(`Remove ${d.name} from ${currentHomeroomClass}?`)) return;
        students = students.filter((st) => st.id !== id);
        dbSaveList(key, students);
        renderClassesPage();
        showToast(`${d.name} removed from class`);
      }

      // ══════════════════════════════════════════════════════
      // ─── TEACHER PORTAL (DB-backed assignments) ──────────
      // ══════════════════════════════════════════════════════
      function teacherPortal() {
        const assignments = dbGetList("assignments").filter(
          (a) => a.teacherId === currentUser.id,
        );
        return `<div class="inner">
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2>Teacher <em>Portal</em></h2><p>Assignments, classes & resources — ${escapeHtml(currentUser.name)}</p></div>
      <button class="btn btn-crimson" onclick="toggleForm('af')">+ New Assignment</button>
    </div>

    <div id="af" style="display:none;margin-bottom:24px">
      <div class="card">
        <div class="card-title">✏️ Create Assignment</div>
        <div class="frow">
          <div class="ffield"><div class="flabel">Title</div><input class="finput" id="as-title" placeholder="e.g. Forces & Motion Quiz"></div>
          <div class="ffield"><div class="flabel">Subject</div>
            <select class="fselect" id="as-subj"><option>Mathematics</option><option>Physics</option><option>Computer Science</option><option>ICT</option></select>
          </div>
          <div class="ffield"><div class="flabel">Class</div>
            <select class="fselect" id="as-cls"><option>Form 3 · 9A</option><option>Form 4 · 10A</option><option>Form 4 · 10B</option><option>Form 5 · 11A</option><option>Form 5 · 11B</option></select>
          </div>
        </div>
        <div class="frow">
          <div class="ffield"><div class="flabel">Due Date</div><input class="finput" type="date" id="as-due"></div>
          <div class="ffield"><div class="flabel">Total Marks</div><input class="finput" type="number" id="as-marks" placeholder="100" value="100"></div>
        </div>
        <div class="ffield" style="margin-bottom:14px"><div class="flabel">Instructions</div><textarea class="ftextarea" id="as-instructions" placeholder="Describe the task…"></textarea></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-crimson" onclick="publishAssignment()">Publish</button>
          <button class="btn btn-ghost" onclick="toggleForm('af')">Cancel</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-title">📋 Active Assignments (${assignments.length})</div>
      ${assignments
        .map(
          (a, i) => `
        <div class="arow">
          <div class="arow-num">${i + 1}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="font-size:14px;font-weight:500;color:var(--ink)">${escapeHtml(a.title)}</div>
              <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:var(--crimson-pale);color:var(--crimson)">${escapeHtml(a.subject)}</span>
            </div>
            <div style="font-size:12px;color:var(--ink-35);margin-top:2px">${escapeHtml(a.cls)} · Due ${a.due}</div>
            <div style="margin-top:8px;display:flex;align-items:center;gap:10px">
              <div class="pbar" style="width:150px"><div class="pfill" style="width:${Math.round((a.submitted / a.total) * 100)}%;background:var(--crimson)"></div></div>
              <span style="font-size:12px;color:var(--ink-35)">${a.submitted}/${a.total} submitted</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn btn-ghost" data-no-translate style="font-size:12px;padding:7px 11px" onclick="viewSubmissions('${a.id}')">View</button>
            <button class="btn btn-danger" style="font-size:12px;padding:7px 11px" onclick="deleteAssignment('${a.id}')">Delete</button>
          </div>
        </div>`,
        )
        .join("")}
    </div>

    <div class="card">
      <div class="card-title">🏫 My Classes</div>
      <div class="g3">
        ${dbGetList("gb_classes")
          .map((c) => {
            const roster = dbGetList("gradebook_" + c.id);
            return `
          <div class="class-card" style="cursor:pointer" onclick="manageClass('${c.id}')">
            <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${c.color}"></div>
            <div style="font-size:28px;margin-bottom:10px">${c.emoji}</div>
            <div style="font-family:\'Playfair Display\',serif;font-size:15px;font-weight:700;color:var(--navy)">${escapeHtml(c.subject)}</div>
            <div style="font-size:12px;color:var(--ink-35);margin-top:3px">${c.cls} · ${roster.length} students</div>
            <button class="btn btn-ghost" style="margin-top:14px;width:100%;font-size:12px">Manage →</button>
          </div>`;
          })
          .join("")}
      </div>
    </div>
  </div>`;
      }

      function publishAssignment() {
        const title = document.getElementById("as-title").value.trim();
        const subj = document.getElementById("as-subj").value;
        const cls = document.getElementById("as-cls").value;
        const due = document.getElementById("as-due").value;
        const marks =
          parseInt(document.getElementById("as-marks").value) || 100;
        if (!title || !due) {
          showToast("Please fill in title and due date", "err");
          return;
        }
        const gbClass = dbGetList("gb_classes").find((c) => c.cls === cls);
        const totalStudents = gbClass
          ? dbGetList("gradebook_" + gbClass.id).length
          : 30;
        const assignments = dbGetList("assignments");
        assignments.push({
          id: dbGenId("as"),
          title,
          subject: subj,
          cls,
          due,
          submitted: 0,
          total: totalStudents || 30,
          marks,
          teacherId: currentUser.id,
        });
        dbSaveList("assignments", assignments);
        toggleForm("af");
        navigateTo("portal");
        showToast("Assignment published ✓");
      }

      function deleteAssignment(id) {
        const assignments = dbGetList("assignments");
        const a = assignments.find((x) => x.id === id);
        if (!a) return;
        if (!confirm(`Delete "${a.title}"? This will also remove all student submissions for it.`)) return;
        dbSaveList("assignments", assignments.filter((x) => x.id !== id));
        dbSaveList(
          "submissions",
          dbGetList("submissions").filter((s) => s.assignmentId !== id),
        );
        navigateTo("portal");
        showToast("Assignment deleted");
      }

      // ─── ASSIGNMENT SUBMISSIONS & GRADING (teacher) ───────
      function viewSubmissions(assignmentId) {
        const a = dbGetList("assignments").find((x) => x.id === assignmentId);
        if (!a) return;
        const subs = dbGetList("submissions")
          .filter((s) => s.assignmentId === assignmentId)
          .sort((x, y) => y.submittedAt - x.submittedAt);
        const max = a.marks || 100;
        const usersById = usersByIdMap();
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "submissions-modal";
        backdrop.innerHTML = `
    <div class="modal" style="max-width:640px;max-height:85vh;overflow-y:auto">
      <div class="modal-title">📥 Submissions — ${escapeHtml(a.title)}</div>
      <p style="font-size:12px;color:var(--ink-35);margin-top:-14px;margin-bottom:18px">${escapeHtml(a.cls)} · ${escapeHtml(a.subject)} · Due ${a.due} · ${subs.length} submission${subs.length === 1 ? "" : "s"}</p>
      ${
        subs.length
          ? subs
              .map(
                (s) => `
        <div class="arow" style="align-items:flex-start;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;width:100%;gap:10px;flex-wrap:wrap">
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--ink)">${escapeHtml((usersById[s.studentId] && usersById[s.studentId].name) || s.studentName)}</div>
              <div style="font-size:11px;color:var(--ink-35);margin-top:2px">Submitted ${timeAgo(s.submittedAt)}</div>
            </div>
            ${
              s.status === "graded"
                ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:rgba(58,122,92,.12);color:#3A7A5C;height:fit-content">Graded · ${s.grade}/${max}</span>`
                : `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:var(--gold-pale);color:var(--gold);height:fit-content">Awaiting grade</span>`
            }
          </div>
          ${s.text ? `<div style="font-size:13px;color:var(--ink-60);line-height:1.5;background:var(--ivory);padding:10px 12px;border-radius:8px;width:100%">${escapeHtml(s.text)}</div>` : ""}
          ${s.fileName ? `<a href="${s.fileData}" download="${escapeHtml(s.fileName)}" style="font-size:12px;color:var(--navy-mid);text-decoration:underline">📎 ${escapeHtml(s.fileName)}</a>` : ""}
          <div class="frow" style="width:100%;margin-bottom:0">
            <div class="ffield" style="max-width:100px">
              <div class="flabel">Grade /${max}</div>
              <input class="finput" type="number" min="0" max="${max}" id="grade-${s.id}" value="${s.grade === null || s.grade === undefined ? "" : s.grade}">
            </div>
            <div class="ffield">
              <div class="flabel">Feedback</div>
              <input class="finput" id="feedback-${s.id}" value="${escapeHtml(s.feedback || "")}" placeholder="Optional feedback…">
            </div>
          </div>
          <button class="btn btn-crimson" style="font-size:12px;padding:7px 11px" onclick="saveGrade('${s.id}','${assignmentId}')">Save Grade</button>
        </div>`,
              )
              .join("")
          : `<p style="font-size:13px;color:var(--ink-35)">No submissions yet.</p>`
      }
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('submissions-modal').remove()">Close</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
      }

      function saveGrade(submissionId, assignmentId) {
        const a = dbGetList("assignments").find((x) => x.id === assignmentId);
        const max = a ? a.marks || 100 : 100;
        const gradeInput = document.getElementById(`grade-${submissionId}`);
        const feedbackInput = document.getElementById(`feedback-${submissionId}`);
        const gradeVal = gradeInput ? gradeInput.value.trim() : "";
        if (
          gradeVal === "" ||
          isNaN(gradeVal) ||
          Number(gradeVal) < 0 ||
          Number(gradeVal) > max
        ) {
          showToast(`Enter a valid grade between 0 and ${max}`, "err");
          return;
        }
        const submissions = dbGetList("submissions");
        const idx = submissions.findIndex((s) => s.id === submissionId);
        if (idx === -1) return;
        submissions[idx].grade = Number(gradeVal);
        submissions[idx].feedback = feedbackInput ? feedbackInput.value.trim() : "";
        submissions[idx].status = "graded";
        submissions[idx].gradedAt = Date.now();
        dbSaveList("submissions", submissions);
        showToast("Grade saved ✓");
        viewSubmissions(assignmentId);
      }

      // ══════════════════════════════════════════════════════
      // ─── GRADEBOOK (DB-backed, editable grades) ───────────
      // ══════════════════════════════════════════════════════
      function gradebook() {
        if (gradebookShowReportCards) return teacherReportCards();
        return currentGradebookClass
          ? gradebookClassView(currentGradebookClass)
          : gradebookClassList();
      }

      function showGradebookReportCards() {
        gradebookShowReportCards = true;
        renderGradebookPage();
      }

      function hideGradebookReportCards() {
        gradebookShowReportCards = false;
        renderGradebookPage();
      }

      function gradebookClassList() {
        const classes = dbGetList("gb_classes");
        return `<div class="inner">
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2><em>Gradebook</em></h2><p>Select a class to view and manage grades — ${escapeHtml(currentUser.name)}</p></div>
      <button class="icon-btn" onclick="showGradebookReportCards()" title="Report Cards" aria-label="Report Cards">⋯</button>
    </div>
    <div class="g3">
      ${classes
        .map((c) => {
          const roster = dbGetList("gradebook_" + c.id);
          const allScores = roster.flatMap((s) => s.scores);
          const avg = allScores.length
            ? Math.round(
                allScores.reduce((a, b) => a + b, 0) / allScores.length,
              )
            : 0;
          return `
        <div class="class-card" style="cursor:pointer" onclick="openGradebookClass('${c.id}')">
          <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${c.color}"></div>
          <div style="font-size:28px;margin-bottom:10px">${c.emoji}</div>
          <div style="font-family:\'Playfair Display\',serif;font-size:15px;font-weight:700;color:var(--navy)">${escapeHtml(c.subject)}</div>
          <div style="font-size:12px;color:var(--ink-35);margin-top:3px">${c.cls} · ${roster.length} students</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:14px">
            <div class="pbar" style="flex:1"><div class="pfill" style="width:${avg}%;background:${c.color}"></div></div>
            <span style="font-size:12px;font-weight:600;color:var(--navy)">${avg}%</span>
          </div>
          <button class="btn btn-ghost" style="margin-top:14px;width:100%;font-size:12px">Open Gradebook →</button>
        </div>`;
        })
        .join("")}
    </div>
  </div>`;
      }

      function openGradebookClass(classId) {
        currentGradebookClass = classId;
        renderGradebookPage();
      }

      function backToGradebookClasses() {
        currentGradebookClass = null;
        renderGradebookPage();
      }

      function gradebookClassView(classId) {
        const cls = dbGetList("gb_classes").find((c) => c.id === classId);
        if (!cls) {
          currentGradebookClass = null;
          return gradebookClassList();
        }
        const students = dbGetList("gradebook_" + classId);
        const colLabels = cls.cols;
        function calcAvg(scores) {
          const a = Math.round(
            scores.reduce((s, x) => s + x, 0) / scores.length,
          );
          return a >= 90
            ? "A*"
            : a >= 80
              ? "A"
              : a >= 70
                ? "B"
                : a >= 60
                  ? "C"
                  : a >= 50
                    ? "D"
                    : a >= 40
                      ? "E"
                      : a >= 30
                        ? "F"
                        : a >= 20
                          ? "G"
                          : "U";
        }
        const gc = (g) =>
          g === "A*" || g.startsWith("A")
            ? "ga"
            : g.startsWith("B")
              ? "gb"
              : g.startsWith("C")
                ? "gc"
                : "gd";
        const usersById = usersByIdMap();
        return `<div class="inner">
    <button class="btn btn-ghost" style="margin-bottom:18px;font-size:12px" onclick="backToGradebookClasses()">← All Classes</button>
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2>${escapeHtml(cls.subject)} <em>Gradebook</em></h2><p>${escapeHtml(cls.cls)} · ${students.length} students — ${escapeHtml(currentUser.name)}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-navy" onclick="showAddStudent()">+ Add Student</button>
        <button class="btn btn-ghost" onclick="exportGrades()">Export CSV</button>
      </div>
    </div>
    <div class="card">
      <div style="overflow-x:auto">
        <table class="gt" id="grades-table">
          <thead>
            <tr>
              <th>Student</th>
              ${colLabels.map((c) => `<th>${c}</th>`).join("")}
              <th>Average</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${students
              .map((s) => {
                const avg = calcAvg(s.scores);
                const d = resolveStudent(s, usersById);
                return `<tr>
                <td>
                  <span class="ft-av ${d.av}" style="display:inline-flex;margin-right:8px;width:26px;height:26px;border-radius:50%;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--ink);flex-shrink:0">${escapeHtml(d.init)}</span>
                  ${escapeHtml(d.name)}
                </td>
                ${s.scores.map((sc, i) => `<td><input class="grade-input" type="number" min="0" max="100" value="${sc}" onchange="updateGrade('${s.id}',${i},this.value)"></td>`).join("")}
                <td><div style="display:flex;align-items:center;gap:6px"><span class="g-chip ${gc(avg)}">${avg}</span><button class="icon-btn-sm" onclick="showReportCardModal(${d.id ? `'${d.id}'` : "null"}, '${d.name.replace(/'/g, "\\'")}')" title="Report Card" aria-label="Report Card">⋮</button></div></td>
                <td><button class="btn btn-danger" style="padding:4px 10px;font-size:11px" onclick="removeStudent('${s.id}')">Remove</button></td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
      }

      function updateGrade(studentId, colIndex, value) {
        const key = "gradebook_" + currentGradebookClass;
        const students = dbGetList(key);
        const s = students.find((st) => st.id === studentId);
        if (!s) return;
        s.scores[colIndex] = Math.min(100, Math.max(0, parseInt(value) || 0));
        dbSaveList(key, students);
        showToast("Grade saved ✓");
      }

      function removeStudent(id) {
        if (!currentGradebookClass) return;
        const key = "gradebook_" + currentGradebookClass;
        let students = dbGetList(key);
        const s = students.find((st) => String(st.id) === String(id));
        if (!s) return;
        const usersById = usersByIdMap();
        const d = resolveStudent(s, usersById);
        if (!confirm(`Remove ${d.name} from this gradebook?`)) return;
        students = students.filter((st) => String(st.id) !== String(id));
        const saved = dbSaveList(key, students);
        if (!saved) {
          showToast("Could not save — try again", "err");
          return;
        }
        renderGradebookPage();
        showToast(`${d.name} removed from gradebook`);
      }

      function showAddStudent() {
        const cls = dbGetList("gb_classes").find(
          (c) => c.id === currentGradebookClass,
        );
        const cols = cls ? cls.cols : ["Test 1", "Test 2", "Test 3", "Test 4"];
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "student-modal";
        backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-title">+ Add Student${cls ? " — " + cls.cls : ""}</div>
      <div class="ffield" style="margin-bottom:12px"><div class="flabel">Full Name</div><input class="finput" id="st-name" placeholder="e.g. Sipho Dlamini"></div>
      <div class="frow">
        ${cols
          .map(
            (l, i) => `
          <div class="ffield"><div class="flabel">${l}</div><input class="finput" type="number" id="st-s${i}" min="0" max="100" placeholder="0–100"></div>`,
          )
          .join("")}
      </div>
      <div class="modal-footer">
        <button class="btn btn-crimson" onclick="saveStudent()">Add to Gradebook</button>
        <button class="btn btn-ghost" onclick="document.getElementById('student-modal').remove()">Cancel</button>
      </div>
    </div>`;
        document.body.appendChild(backdrop);
      }

      function saveStudent() {
        const name = document.getElementById("st-name").value.trim();
        if (!name) {
          showToast("Please enter a name", "err");
          return;
        }
        if (!isValidName(name)) {
          showToast("Name may only contain letters, spaces, hyphens, and apostrophes.", "err");
          return;
        }
        const cls = dbGetList("gb_classes").find(
          (c) => c.id === currentGradebookClass,
        );
        const numCols = cls ? cls.cols.length : 4;
        const scores = Array.from(
          { length: numCols },
          (_, i) => parseInt(document.getElementById(`st-s${i}`).value) || 0,
        );
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
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
        const key = "gradebook_" + currentGradebookClass;
        const students = dbGetList(key);
        const newEntry = {
          id: dbGenId("s"),
          name,
          av: avColors[students.length % 10],
          init: initials,
          scores,
        };
        // If a registered account already exists for this student in this
        // class, link the new row to it by ID instead of leaving it as a
        // disconnected duplicate.
        const match = dbGetList("users").find(
          (u) =>
            u.role === "student" &&
            u.cls === currentGradebookClass &&
            u.name === name,
        );
        if (match) {
          newEntry.userId = match.id;
          newEntry.init = match.initials;
          newEntry.av = match.av;
        }
        students.push(newEntry);
        dbSaveList(key, students);
        document.getElementById("student-modal").remove();
        renderGradebookPage();
        showToast(`${name} added to gradebook ✓`);
      }

      function exportGrades() {
        const cls = dbGetList("gb_classes").find(
          (c) => c.id === currentGradebookClass,
        );
        const key = "gradebook_" + currentGradebookClass;
        const students = dbGetList(key);
        const usersById = usersByIdMap();
        const cols = cls ? cls.cols : [];
        let csv = "Name," + cols.join(",") + ",Average\n";
        students.forEach((s) => {
          const d = resolveStudent(s, usersById);
          const avg = Math.round(
            s.scores.reduce((a, b) => a + b, 0) / s.scores.length,
          );
          csv += `"${d.name}",${s.scores.join(",")},${avg}\n`;
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `gradebook_${currentGradebookClass}.csv`;
        a.click();
        showToast("Grades exported as CSV ✓");
      }

