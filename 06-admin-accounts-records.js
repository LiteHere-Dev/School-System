      // ══════════════════════════════════════════════════════
      // ─── ADMIN RECORDS ────────────────────────────────────
      // ══════════════════════════════════════════════════════
      function parentGrades() {
        const child = dbGetList("users").find(
          (u) => u.id === currentUser.childId,
        );
        const childName = child
          ? child.name
          : currentUser.childName || "your child";
        const subjects = buildReportCard(currentUser.childId || "u1");
        if (!subjects.length) {
          return `<div class="inner">
    <div class="ph"><h2>${childName}'s <em>Grades</em></h2><p>Term 2 · 2026</p></div>
    <div class="card" style="text-align:center;padding:40px;color:var(--ink-35)">No report card has been issued yet. Please check with the school office.</div>
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
    <div class="ph"><h2>${childName}'s <em>Report Card</em></h2><p>Term 2, 2026 · Parent View</p></div>
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

      function adminAIMonitor() {
        const now = Date.now();
        const uptime = Math.floor((now - aiStats.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        const secs = uptime % 60;
        const uptimeStr = hours + "h " + mins + "m " + secs + "s";

        const timeSinceLast = now - lastAIMessageTime;
        const rateLimitRemaining = Math.max(
          0,
          AI_RATE_LIMIT_MS - timeSinceLast,
        );

        const topUsers = Object.entries(aiStats.messagesByUser)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const dailySorted = Object.entries(aiStats.dailyStats)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 7);

        // ── Real telemetry pulled together for the monitor cards ──
        const proc = monRunningModels[0] || null;
        const sizeMB = proc ? proc.size / 1048576 : 0;
        const vramMB = proc && proc.size_vram ? proc.size_vram / 1048576 : 0;
        const vramPct =
          proc && proc.size
            ? Math.round((proc.size_vram / proc.size) * 100)
            : 0;
        // BUG FIX: previously `100 - vramPct` unconditionally, so with no
        // model loaded (proc === null, vramPct === 0) this evaluated to
        // 100 — pinning the "CPU / GPU Split" meter to a full-width red
        // bar even while the card correctly said "Waiting for active
        // session". Now mirrors every other proc-gated stat: 0 when idle.
        const cpuPct = proc ? 100 - vramPct : 0;
        const meterClass = (pct) => (pct > 80 ? "high" : pct > 50 ? "mid" : "");

        const netInfo = getBrowserNetworkInfo();
        const memInfo = getBrowserMemoryInfo();

        const vramSpark = buildSparklinePath(monHistory.vram, 300, 36);
        const latSpark = buildSparklinePath(monHistory.latency, 300, 36);
        const upSpark = buildSparklinePath(monHistory.upload, 300, 36);
        const downSpark = buildSparklinePath(monHistory.download, 300, 36);

        const activeUserCount = Object.keys(aiStats.messagesByUser).length;
        const expiresIn =
          proc && proc.expires_at ? new Date(proc.expires_at) - now : null;
        const expiresStr =
          expiresIn && expiresIn > 0
            ? Math.floor(expiresIn / 60000) +
              "m " +
              Math.floor((expiresIn % 60000) / 1000) +
              "s"
            : proc
              ? "Expired"
              : "—";

        return `<div class="inner">
    <div class="ph" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div><h2>AI <em>Monitor</em></h2><p>Ollama diagnostics & live system resources</p></div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="ai-model-select" class="fselect" style="width:auto;min-width:140px" onchange="switchOllamaModel(this.value)" title="Switch the active AI model">
          ${(OLLAMA_AVAILABLE_MODELS.includes(OLLAMA_MODEL) ? OLLAMA_AVAILABLE_MODELS : [OLLAMA_MODEL, ...OLLAMA_AVAILABLE_MODELS]).map((m) => {
            const installed = isModelFamilyInstalled(m);
            const tag = installed ? resolveOllamaModelTag(m) : null;
            const sizeLabel = tag && tag.includes(":") ? ` (${tag.split(":")[1]})` : "";
            return `<option value="${m}" ${m === OLLAMA_MODEL ? "selected" : ""}>${installed ? "✓" : "⚠"} ${m}${sizeLabel}</option>`;
          }).join("")}
        </select>
        <button class="btn btn-crimson" onclick="checkOllamaStatus();monPollTick();showToast('Status refreshed')">🔄 Refresh</button>
        <div style="font-size:11px;color:var(--ink-35);align-self:center">${monLastRefresh ? "Updated " + Math.round((Date.now()-monLastRefresh)/1000) + "s ago" : "Pending first refresh…"}</div>
        <button class="btn btn-danger" onclick="resetAIStats()">Reset Stats</button>
      </div>
    </div>

    <div class="g4" style="margin-bottom:22px">
      <div class="stat ${aiConnected ? "gr" : "cr"}" id="mon-status-card">
        <div class="stat-icon" id="mon-status-icon">${aiConnected ? "✅" : "❌"}</div>
        <div class="stat-num" id="mon-status-val">${aiConnected ? t("aiOnline") : t("aiOffline")}</div>
        <div class="stat-label">Ollama Status</div>
      </div>
      <div class="stat nv">
        <div class="stat-icon">📊</div>
        <div class="stat-num" id="mon-messages-val">${aiStats.totalMessages}</div>
        <div class="stat-label">Total Messages</div>
      </div>
      <div class="stat gd">
        <div class="stat-icon">⚠️</div>
        <div class="stat-num" id="mon-errors-val">${aiStats.errors}</div>
        <div class="stat-label">Errors</div>
      </div>
      <div class="stat gr">
        <div class="stat-icon">⏱️</div>
        <div class="stat-num" id="mon-uptime-val">${uptimeStr}</div>
        <div class="stat-label">Session Uptime</div>
      </div>
    </div>

    <div class="mon-section-title">🖥️ System Resources ${aiConnected ? '<span class="mon-live-dot" style="margin-left:2px"></span>' : '<span class="mon-live-dot off" style="margin-left:2px"></span>'}</div>

    ${!aiConnected ? `<div class="mon-banner">⚠️ Ollama isn't reachable right now, so live resource data can't be read. These cards will populate automatically as soon as <code>ollama run ${OLLAMA_MODEL}</code> is active.</div>` : ""}
    ${aiConnected && !proc ? `<div class="mon-banner">ℹ️ Ollama is online but no model is currently loaded into memory. Resource cards will fill in once a chat request loads <code>${OLLAMA_MODEL}</code>.</div>` : ""}

    <div class="mon-grid" style="margin-bottom:18px">

      <!-- Model Memory (RAM) -->
      <div class="mon-card ${cpuPct > 80 && proc ? "warn" : ""}">
        <div class="mon-card-head">
          <div class="mon-card-title"><span class="mon-card-icon">🧮</span>Model Memory</div>
          <div class="mon-live-dot ${proc ? "" : "off"}"></div>
        </div>
        <div class="mon-value-row">
          <span class="mon-value">${proc ? sizeMB.toFixed(0) : "—"}</span>
          <span class="mon-unit">${proc ? "MB total" : ""}</span>
        </div>
        <div class="mon-sub">${proc ? proc.name : "No model loaded"}</div>
        <div class="mon-meter"><div class="mon-meter-fill ${meterClass(cpuPct)}" style="width:${proc ? 100 : 0}%"></div></div>
      </div>

      <!-- CPU / GPU split -->
      <div class="mon-card ${cpuPct > 80 && proc ? "warn" : ""}">
        <div class="mon-card-head">
          <div class="mon-card-title"><span class="mon-card-icon">⚙️</span>CPU / GPU Split</div>
          <div class="mon-live-dot ${proc ? "" : "off"}"></div>
        </div>
        <div class="mon-value-row">
          <span class="mon-value">${proc ? cpuPct : "—"}</span>
          <span class="mon-unit">${proc ? "% CPU" : ""}</span>
        </div>
        <div class="mon-sub">${proc ? vramPct + "% GPU · " + vramMB.toFixed(0) + " MB VRAM" : "Waiting for active session"}</div>
        <div class="mon-meter"><div class="mon-meter-fill ${meterClass(cpuPct)}" style="width:${proc ? cpuPct : 0}%"></div></div>
      </div>

      <!-- Round-trip latency (real, measured) -->
      <div class="mon-card ${monLatencyMs && monLatencyMs > 500 ? "warn" : ""}" id="mon-latency-card">
        <div class="mon-card-head">
          <div class="mon-card-title"><span class="mon-card-icon">📡</span>Host Latency</div>
          <div class="mon-live-dot ${aiConnected ? "" : "off"}" id="mon-latency-dot"></div>
        </div>
        <div class="mon-value-row">
          <span class="mon-value" id="mon-latency-val">${monLatencyMs !== null ? monLatencyMs : "—"}</span>
          <span class="mon-unit" id="mon-latency-unit">${monLatencyMs !== null ? "ms" : ""}</span>
        </div>
        <div class="mon-sub">Round-trip to ${OLLAMA_URL.replace("http://", "")}</div>
        <svg class="mon-spark" viewBox="0 0 300 36" preserveAspectRatio="none">
          <path class="mon-spark-fill nv" id="mon-lat-spark-fill" d="${latSpark.fill}"></path>
          <path class="mon-spark-line nv" id="mon-lat-spark-line" d="${latSpark.line}"></path>
        </svg>
      </div>

      <!-- Context / unload countdown -->
      <div class="mon-card">
        <div class="mon-card-head">
          <div class="mon-card-title"><span class="mon-card-icon">🗂️</span>Context Window</div>
          <div class="mon-live-dot ${proc ? "" : "off"}"></div>
        </div>
        <div class="mon-value-row">
          <span class="mon-value">${proc ? proc.context_length : "—"}</span>
          <span class="mon-unit">${proc ? "tokens" : ""}</span>
        </div>
        <div class="mon-sub">Unloads in ${expiresStr}</div>
        <div class="mon-meter"><div class="mon-meter-fill" style="width:${proc ? 100 : 0}%"></div></div>
      </div>
    </div>

    <div class="mon-grid" style="grid-template-columns:1.4fr 1fr 1fr;margin-bottom:18px">

      <!-- Bandwidth: real bytes moved to/from Ollama -->
      <div class="mon-card">
        <div class="mon-card-head">
          <div class="mon-card-title"><span class="mon-card-icon">🌐</span>AI Bandwidth (this session)</div>
          <div class="mon-live-dot ${aiConnected ? "" : "off"}"></div>
        </div>
        <div class="mon-netcols">
          <div class="mon-netcol">
            <div class="mon-netcol-label"><span class="mon-arrow-up">▲</span> Upload</div>
            <div class="mon-value" id="mon-upload-val" style="font-size:20px">${monBytesToReadable(monNetBaseline.up)}</div>
            <svg class="mon-spark" viewBox="0 0 300 36" preserveAspectRatio="none">
              <path class="mon-spark-fill" id="mon-up-spark-fill" d="${upSpark.fill}"></path>
              <path class="mon-spark-line" id="mon-up-spark-line" d="${upSpark.line}"></path>
            </svg>
          </div>
          <div class="mon-netcol">
            <div class="mon-netcol-label"><span class="mon-arrow-down">▼</span> Download</div>
            <div class="mon-value" id="mon-download-val" style="font-size:20px">${monBytesToReadable(monNetBaseline.down)}</div>
            <svg class="mon-spark" viewBox="0 0 300 36" preserveAspectRatio="none">
              <path class="mon-spark-fill nv" id="mon-down-spark-fill" d="${downSpark.fill}"></path>
              <path class="mon-spark-line nv" id="mon-down-spark-line" d="${downSpark.line}"></path>
            </svg>
          </div>
        </div>
        <div class="mon-sub" style="margin-top:4px">Measured from actual request/response payloads sent to ${OLLAMA_MODEL} · resets on page reload</div>
      </div>

      <!-- Browser connection info -->
      <div class="mon-card">
        <div class="mon-card-head">
          <div class="mon-card-title"><span class="mon-card-icon">📶</span>Network Link</div>
          <div class="mon-live-dot ${netInfo.supported ? "" : "off"}"></div>
        </div>
        ${
          netInfo.supported
            ? `
        <div class="mon-value-row"><span class="mon-value" style="font-size:22px">${netInfo.effectiveType ? netInfo.effectiveType.toUpperCase() : "—"}</span></div>
        <div class="mon-sub">${netInfo.downlinkMbps !== null ? netInfo.downlinkMbps + " Mbps est." : "Speed unknown"} ${netInfo.rttMs !== null ? "· " + netInfo.rttMs + "ms RTT" : ""}</div>
        `
            : `<div class="mon-sub" style="padding-top:4px">Unsupported in this browser (Network Information API is Chromium-only)</div>`
        }
      </div>

      <!-- Browser JS heap as a real memory proxy -->
      <div class="mon-card">
        <div class="mon-card-head">
          <div class="mon-card-title"><span class="mon-card-icon">💾</span>Browser Heap</div>
          <div class="mon-live-dot ${memInfo.supported ? "" : "off"}"></div>
        </div>
        ${
          memInfo.supported
            ? `
        <div class="mon-value-row">
          <span class="mon-value">${memInfo.usedMB.toFixed(0)}</span>
          <span class="mon-unit">MB</span>
        </div>
        <div class="mon-sub">of ${memInfo.limitMB.toFixed(0)} MB limit</div>
        <div class="mon-meter"><div class="mon-meter-fill ${meterClass((memInfo.usedMB / memInfo.limitMB) * 100)}" style="width:${Math.min(100, (memInfo.usedMB / memInfo.limitMB) * 100)}%"></div></div>
        `
            : `<div class="mon-sub" style="padding-top:4px">Unsupported in this browser (performance.memory is Chromium-only)</div>`
        }
      </div>
    </div>

    <div class="g2">
      <div class="card">
        <div class="card-title">🔧 Diagnostics</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <!-- Active model — always reflects the dropdown selection -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--ink-12)">
            <span style="font-size:13px;color:var(--ink-60)">Active Model</span>
            <span style="font-size:13px;font-weight:700;color:var(--navy);background:var(--navy-pale,#eef1f8);padding:2px 10px;border-radius:20px;font-family:monospace">${OLLAMA_MODEL}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--ink-12)">
            <span style="font-size:13px;color:var(--ink-60)">Endpoint</span>
            <span style="font-size:13px;font-family:monospace">${OLLAMA_URL}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--ink-12)">
            <span style="font-size:13px;color:var(--ink-60)">Rate Limit</span>
            <span style="font-size:13px;font-weight:600">${currentUser && currentUser.uid === "A-001" ? "Exempt (this account)" : AI_RATE_LIMIT_MS > 0 ? Math.round(AI_RATE_LIMIT_MS / 1000) + " seconds" : "None"}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--ink-12)">
            <span style="font-size:13px;color:var(--ink-60)">Input Screening</span>
            <span style="font-size:13px;font-weight:600">${currentUser && currentUser.uid === "A-001" ? "Unrestricted (System Admin)" : "Standard"}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--ink-12)">
            <span style="font-size:13px;color:var(--ink-60)">Cooldown Remaining</span>
            <span id="mon-cooldown-val" style="font-size:13px;font-weight:600;color:${currentUser && currentUser.uid === "A-001" ? "#3A7A5C" : rateLimitRemaining > 0 ? "var(--crimson)" : "#3A7A5C"}">${currentUser && currentUser.uid === "A-001" ? "N/A — unthrottled" : rateLimitRemaining > 0 ? Math.ceil(rateLimitRemaining / 1000) + "s" : "Ready"}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0">
            <span style="font-size:13px;color:var(--ink-60)">Last Message</span>
            <span id="mon-lastmsg-val" style="font-size:13px;font-weight:600">${lastAIMessageTime ? timeAgo(lastAIMessageTime) : "Never"}</span>
          </div>
        </div>
        <button class="btn btn-navy" style="width:100%;margin-top:14px" onclick="forceCheckOllama()">Test Connection Now</button>
      </div>

      <div class="card">
        <div class="card-title">👥 Active Users & Connections</div>
        <div style="display:flex;justify-content:space-between;padding:10px 0 14px;border-bottom:1px solid var(--ink-12);margin-bottom:4px">
          <span style="font-size:13px;color:var(--ink-60)">Distinct users this session</span>
          <span id="mon-activeusers-val" style="font-size:15px;font-weight:700;color:var(--navy)">${activeUserCount}</span>
        </div>
        ${
          topUsers.length === 0
            ? '<div style="text-align:center;padding:20px;color:var(--ink-35);font-size:13px">No messages yet</div>'
            : topUsers
                .map(([uid, count]) => {
                  const user = dbGetList("users").find(
                    (u) => (u.uid || u.id) === uid,
                  );
                  return `<div class="mon-proc-row">
              <div class="mon-proc-name">
                <span class="dot"></span>
                <span class="ft-av ${user ? user.av : "av1"}" style="width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">${user ? user.initials : "??"}</span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user ? user.name : uid}</span>
              </div>
              <span class="mon-proc-meta">${count} msgs</span>
            </div>`;
                })
                .join("")
        }
      </div>

      <!-- ── Conversation Diagnostics Log ─────────────────────────────── -->
      <div class="card" style="grid-column:1/-1;margin-top:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div class="card-title" style="margin-bottom:0">📋 Live Conversation Log</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;color:var(--ink-35)">${diagLog.length} / 50 entries &nbsp;·&nbsp; model: <strong>${OLLAMA_MODEL}</strong></span>
            <button class="btn" style="font-size:11px;padding:4px 10px;background:var(--ink-08,#f2f2f2);color:var(--ink-60)" onclick="diagLog=[];monPollTick();showToast('Log cleared')">Clear</button>
          </div>
        </div>
        ${diagLog.length === 0
          ? `<div style="text-align:center;padding:28px 0;color:var(--ink-35);font-size:13px">
               <div style="font-size:28px;margin-bottom:8px">💬</div>
               No conversations yet — messages sent to the AI assistant will appear here in real time.
             </div>`
          : `<div style="overflow-x:auto">
               <table style="width:100%;border-collapse:collapse;font-size:12px">
                 <thead>
                   <tr style="background:var(--ink-04,#f8f8f8);text-align:left">
                     <th style="padding:8px 10px;font-weight:600;color:var(--ink-60);white-space:nowrap;border-bottom:1px solid var(--ink-12)">Time</th>
                     <th style="padding:8px 10px;font-weight:600;color:var(--ink-60);white-space:nowrap;border-bottom:1px solid var(--ink-12)">Account</th>
                     <th style="padding:8px 10px;font-weight:600;color:var(--ink-60);white-space:nowrap;border-bottom:1px solid var(--ink-12)">Role</th>
                     <th style="padding:8px 10px;font-weight:600;color:var(--ink-60);white-space:nowrap;border-bottom:1px solid var(--ink-12)">Model</th>
                     <th style="padding:8px 10px;font-weight:600;color:var(--ink-60);border-bottom:1px solid var(--ink-12)">Message</th>
                     <th style="padding:8px 10px;font-weight:600;color:var(--ink-60);border-bottom:1px solid var(--ink-12)">Reply Preview</th>
                     <th style="padding:8px 10px;font-weight:600;color:var(--ink-60);white-space:nowrap;border-bottom:1px solid var(--ink-12);text-align:right">Runtime</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${[...diagLog].reverse().map((e, i) => {
                     const stripe = i % 2 === 1 ? "background:var(--ink-02,#fafafa)" : "";

                     // ── Model-switch entries get their own banner row,
                     // spanning every column, instead of the normal
                     // per-message columns — this is what makes a switch
                     // actually visible in the log rather than just
                     // inferred from the ⚠️ marker on later rows.
                     if (e.type === "switch") {
                       const switchColor = e.auto ? "#9b6b00" : "var(--navy)";
                       const switchBg = e.auto ? "rgba(191,160,74,0.12)" : "rgba(15,40,80,0.06)";
                       const ts = new Date(e.ts);
                       const timeStr = ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                       return `<tr style="border-bottom:1px solid var(--ink-08,#f2f2f2);background:${switchBg}">
                         <td colspan="7" style="padding:8px 10px;font-size:12px;color:${switchColor}">
                           <strong>${e.auto ? "🔁 Auto-switched" : "🔁 Switched"}</strong>
                           &nbsp;<span style="font-family:monospace">${escapeHtml(e.fromModel)}</span> → <span style="font-family:monospace;font-weight:700">${escapeHtml(e.toModel)}</span>
                           &nbsp;·&nbsp;<span style="font-family:monospace;font-size:11px;color:var(--ink-35)">${timeStr}</span>
                           &nbsp;·&nbsp;<em>${escapeHtml(e.reason || (e.auto ? "task required a better-equipped model" : "manual switch"))}</em>
                           &nbsp;·&nbsp;<span style="color:var(--ink-35)">by ${escapeHtml(e.who || "System")}</span>
                         </td>
                       </tr>`;
                     }

                     const roleColor = e.role === "admin" ? "var(--crimson)" : e.role === "teacher" ? "var(--navy)" : "#3A7A5C";
                     const runtimeColor = e.runtimeMs > 10000 ? "var(--crimson)" : e.runtimeMs > 5000 ? "#c97a00" : "#3A7A5C";
                     const ts = new Date(e.ts);
                     const timeStr = ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                     const modelChanged = e.model !== OLLAMA_MODEL;
                     return `<tr style="border-bottom:1px solid var(--ink-08,#f2f2f2);${stripe}">
                       <td style="padding:8px 10px;white-space:nowrap;color:var(--ink-45);font-family:monospace;font-size:11px">${timeStr}</td>
                       <td style="padding:8px 10px;white-space:nowrap;font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(e.user)}</td>
                       <td style="padding:8px 10px;white-space:nowrap">
                         <span style="font-size:10px;font-weight:700;color:${roleColor};background:${roleColor}18;padding:2px 7px;border-radius:12px;text-transform:uppercase;letter-spacing:.4px">${e.role}</span>
                       </td>
                       <td style="padding:8px 10px;white-space:nowrap;font-family:monospace;font-size:11px${modelChanged ? ";color:var(--crimson)" : ""}">
                         ${escapeHtml(e.model)}${modelChanged ? " ⚠️" : ""}
                       </td>
                       <td style="padding:8px 10px;color:var(--ink-70);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(e.msgSnippet)}">${escapeHtml(e.msgSnippet)}</td>
                       <td style="padding:8px 10px;color:var(--ink-45);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-style:italic" title="${escapeHtml(e.replySnippet)}">${escapeHtml(e.replySnippet)}</td>
                       <td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:11px;font-weight:700;color:${runtimeColor};white-space:nowrap">
                         ${e.runtimeMs >= 1000 ? (e.runtimeMs / 1000).toFixed(1) + "s" : e.runtimeMs + "ms"}
                       </td>
                     </tr>`;
                   }).join("")}
                 </tbody>
               </table>
             </div>`
        }
      </div>
    </div>

    <div class="card" style="margin-top:20px;${webSecState.killSwitch ? "border-color:var(--crimson);background:var(--crimson-pale)" : ""}">
      <div class="card-title" style="${webSecState.killSwitch ? "color:var(--crimson)" : ""}">${webSecState.killSwitch ? "🚨 Security Lockdown Active" : "🛡️ Web Search & Security"}</div>
      ${
        webSecState.killSwitch
          ? `<div style="font-size:13px;color:var(--crimson);margin-bottom:10px"><strong>Reason:</strong> ${escapeHtml(webSecState.lockdownReason || "Unknown")}<br><strong>Triggered:</strong> ${webSecState.lockdownAt ? timeAgo(webSecState.lockdownAt) : "—"}</div>
             <div style="font-size:13px;color:var(--ink-60);margin-bottom:14px">The AI assistant has been automatically disabled for every user until an admin reviews the security events below and clears the lockdown.</div>
             ${currentUser && currentUser.role === "admin" ? `<button class="btn btn-danger" style="width:100%" onclick="clearSecurityLockdown()">Review complete — Re-enable AI Assistant</button>` : `<div style="font-size:12px;color:var(--ink-45)">Only an admin can clear this lockdown.</div>`}`
          : `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--ink-12)">
               <span style="font-size:13px;color:var(--ink-60)">Web search feature</span>
               <span style="font-size:13px;font-weight:600;color:${webSecState.enabled ? "#3A7A5C" : "var(--crimson)"}">${webSecState.enabled ? "Enabled" : "Disabled"}</span>
             </div>
             <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--ink-12)">
               <span style="font-size:13px;color:var(--ink-60)">Searches performed</span>
               <span style="font-size:13px;font-weight:600">${webSecState.totalSearches}</span>
             </div>
             <div style="display:flex;justify-content:space-between;padding:8px 0">
               <span style="font-size:13px;color:var(--ink-60)">Malicious results blocked</span>
               <span style="font-size:13px;font-weight:600;color:${webSecState.blockedCount > 0 ? "var(--crimson)" : "inherit"}">${webSecState.blockedCount}</span>
             </div>
             ${currentUser && currentUser.role === "admin" ? `<button class="btn btn-navy" style="width:100%;margin-top:12px" onclick="toggleWebSearchEnabled()">${webSecState.enabled ? "Disable" : "Enable"} Web Search</button>` : ""}`
      }
      ${
        webSecState.events.length
          ? `<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--ink-12)">
               <div style="font-size:12px;font-weight:600;color:var(--ink-60);margin-bottom:8px">Recent security events</div>
               ${webSecState.events
                 .slice(0, 8)
                 .map(
                   (ev) =>
                     `<div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--ink-12)"><span style="font-weight:600;color:${ev.type === "LOCKDOWN" ? "var(--crimson)" : ev.type === "FALSE_POSITIVE_SUSPECTED" ? "#b8860b" : "inherit"}">${escapeHtml(ev.type)}</span> · ${timeAgo(ev.time)}<br><span style="color:var(--ink-60)">${escapeHtml(ev.detail || "")}</span></div>`,
                 )
                 .join("")}
             </div>`
          : ""
      }
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- BLACKLIST WORD MANAGER                                          -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="card" style="margin-top:20px">
      <div class="card-title">🚫 Content Blacklist</div>
      <p style="font-size:13px;color:var(--ink-60);margin:0 0 14px">
        Words added here are scanned across all forum posts &amp; replies every 2 seconds.
        Matches are flagged below. Detected malicious patterns trigger an immediate AI lockdown.
      </p>

      <!-- Add word row -->
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input id="bl-add-input"
          type="text"
          placeholder="Enter word or phrase…"
          style="flex:1;padding:9px 12px;border:1.5px solid var(--ink-20);border-radius:8px;font-size:13px;background:var(--bg);color:var(--ink)"
          onkeydown="if(event.key==='Enter')blacklistSubmitFromInput()"
        />
        <button class="btn btn-crimson" onclick="blacklistSubmitFromInput()">+ Add</button>
      </div>

      <!-- Current blacklist chips -->
      <div id="bl-word-chips">
      ${blacklistState.words.length === 0
        ? `<div style="font-size:13px;color:var(--ink-35);text-align:center;padding:12px 0">No blacklisted words yet.</div>`
        : `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">
            ${blacklistState.words.map(w => `
              <span style="display:inline-flex;align-items:center;gap:6px;background:var(--crimson-pale);color:var(--crimson);border:1px solid var(--crimson-soft,#f3c0c0);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600">
                ${escapeHtml(w)}
                <button onclick="blacklistRemoveWord('${escapeHtml(w)}')"
                  style="background:none;border:none;cursor:pointer;color:var(--crimson);font-size:14px;line-height:1;padding:0;margin-left:2px"
                  title="Remove">×</button>
              </span>`).join("")}
          </div>`
      }
      </div>

      <!-- Scanner status pill -->
      <div id="bl-scanner-status" style="margin-top:14px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-60)">
        <span style="width:8px;height:8px;border-radius:50%;background:${blacklistState.words.length ? "#22c55e" : "var(--ink-35)"};display:inline-block;flex-shrink:0"></span>
        Scanner ${blacklistState.words.length ? `active — ${blacklistState.words.length} word${blacklistState.words.length > 1 ? "s" : ""} watched · refreshes every 2 s` : "idle (add words above to activate)"}
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- FLAG REPORT                                                     -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    ${(() => {
      const hasUnreviewed = blacklistState.flags.some(f => !f.reviewed);
      return `<div id="bl-flag-report" class="card" style="margin-top:20px${hasUnreviewed ? ";border-color:var(--crimson)" : ""}">${renderBlacklistFlagReportHTML()}</div>`;
    })()}

    <div class="card" style="margin-top:20px">
      <div class="card-title">📅 Daily Usage</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${
          dailySorted.length === 0
            ? '<div style="text-align:center;padding:20px;color:var(--ink-35);font-size:13px">No activity recorded</div>'
            : dailySorted
                .map(
                  ([
                    date,
                    count,
                  ]) => `<div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:12px;color:var(--ink-60);width:80px">${date}</div>
            <div class="pbar" style="flex:1"><div class="pfill" style="width:${Math.min(100, count * 5)}%;background:var(--crimson)"></div></div>
            <span style="font-size:12px;font-weight:600;min-width:40px;text-align:right">${count}</span>
          </div>`,
                )
                .join("")
        }
      </div>
    </div>

    ${
      aiStats.lastError
        ? `
    <div class="card" style="margin-top:20px;border-color:var(--crimson-soft)">
      <div class="card-title" style="color:var(--crimson)">⚠️ Last Error</div>
      <div style="font-size:12px;color:var(--ink-60);margin-bottom:8px">${timeAgo(aiStats.lastError.time)} · ${aiStats.lastError.user}</div>
      <div style="font-size:13px;color:var(--crimson);background:var(--crimson-pale);padding:12px;border-radius:8px;font-family:monospace">${escapeHtml(aiStats.lastError.message)}</div>
    </div>`
        : ""
    }
  </div>`;
      }

      function resetAIStats() {
        if (!confirm("Reset all AI usage statistics? This cannot be undone."))
          return;
        aiStats = {
          totalMessages: 0,
          totalTokens: 0,
          errors: 0,
          lastError: null,
          uptime: 0,
          startTime: Date.now(),
          messagesByUser: {},
          dailyStats: {},
        };
        lastAIMessageTime = 0;
        monHistory = { vram: [], latency: [], upload: [], download: [] };
        monNetBaseline = { up: 0, down: 0 };
        navigateTo("aimonitor");
        showToast("AI statistics reset");
      }

      async function forceCheckOllama() {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = "Checking...";
        await checkOllamaStatus();
        btn.disabled = false;
        btn.textContent = "Test Connection Now";
        navigateTo("aimonitor");
        showToast(aiConnected ? "Ollama is online ✓" : "Ollama is offline ✗");
      }

      function adminRecords() {
        const depts = [
          {
            dept: "STEM",
            pass: 74,
            students: 680,
            subj: "Maths, Physics, CS, ICT, Biology, Chemistry",
            c: "var(--crimson)",
          },
          {
            dept: "Humanities",
            pass: 81,
            students: 520,
            subj: "English, History, Geography, Social Studies, PSRE",
            c: "var(--navy-mid)",
          },
          {
            dept: "Commerce",
            pass: 78,
            students: 310,
            subj: "Accounting, Business Studies, Economics",
            c: "var(--gold)",
          },
          {
            dept: "Languages",
            pass: 83,
            students: 420,
            subj: "SiSwati, French, isiZulu",
            c: "#3A7A5C",
          },
          {
            dept: "Creative Arts",
            pass: 88,
            students: 290,
            subj: "Art & Design, Music, Drama",
            c: "#7A4080",
          },
          {
            dept: "Technical",
            pass: 70,
            students: 340,
            subj: "Agriculture, Home Economics, Technical Drawing",
            c: "#7A4040",
          },
        ];
        return `<div class="inner">
    <div class="ph"><h2>Academic <em>Records</em></h2><p>School-wide results overview · Term 2, 2026</p></div>
    <div class="g2">
      ${depts
        .map(
          (d) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-family:\'Playfair Display\',serif;font-size:17px;font-weight:700;color:var(--navy)">${d.dept}</div>
              <div style="font-size:12px;color:var(--ink-35);margin-top:3px">${d.subj}</div>
              <div style="font-size:12px;color:var(--ink-35);margin-top:2px">${d.students} students</div>
            </div>
            <div style="font-family:\'Playfair Display\',serif;font-size:28px;font-weight:900;color:var(--navy)">${d.pass}%</div>
          </div>
          <div class="pbar"><div class="pfill" style="width:${d.pass}%;background:${d.c}"></div></div>
          <div style="font-size:12px;color:var(--ink-35);margin-top:5px">Pass rate</div>
        </div>`,
        )
        .join("")}
    </div>
  </div>`;
      }

      // ─── HELPERS ─────────────────────────────────────────
      function toggleForm(id) {
        const el = document.getElementById(id);
        if (el)
          el.style.display = el.style.display === "none" ? "block" : "none";
      }

      function navIcon(id) {
        const icons = {
          dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
          portal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
          grades: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
          forums: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
          admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
          accounts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
          report: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
          reportcards: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
          classes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>`,
          homeroom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>`,
          auditlog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
          aimonitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
          syshealth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
          backups: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
          migrations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
          more: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
        };
        return icons[id] || icons.dashboard;
      }

      // ─── INIT ────────────────────────────────────────────
      // App data now lives in PostgreSQL (via the local API server) instead
      // of localStorage, so the database must be fetched over the network
      // before anything reads it. This whole block waits for that fetch —
      // note it's an async IIFE, so it runs synchronously up to the first
      // `await`, then yields: the rest of this script (further down, where
      // OLLAMA_MODEL/webSecState/blacklistState are declared) still finishes
      // executing top-to-bottom *before* this function resumes after the
      // await, so those variables are safely initialized by the time we
      // come back to merge their saved values in below.
      (function () {
        // Restore any translations the AI has produced in the past —
        // works even if Ollama is offline right now (see the AUTOMATIC
        // TRANSLATION OBSERVER section for why this matters).
        _loadTranslateCache();
        // Apply saved language immediately on page load
        applyTranslations();
        // Watches the whole document from here on — any content
        // rendered anywhere, at any point, gets auto-translated
        // whenever a non-English language is active. See the
        // AUTOMATIC TRANSLATION OBSERVER section above for why.
        initLanguageAutoObserver();

        const loginBtn = document.querySelector(".login-btn");
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.textContent = "Sign In →";
        }
        updateDbBadge();

        // Non-sensitive, low-stakes fetch: just the banned-word list, used
        // to warn against blacklisted words when someone picks a signup
        // password. See /api/public/blacklist-words in server.js for why
        // this doesn't need the general (now locked-down) kv_store.
        fetch("/api/public/blacklist-words")
          .then((r) => (r.ok ? r.json() : { words: [] }))
          .then((d) => { blacklistState.words = d.words || []; })
          .catch(() => {});

        // On a brand-new, never-seeded install this succeeds (the server
        // allows the one-time bootstrap write) and seeds the default demo
        // dataset. On any already-seeded (i.e. normal, already-in-use)
        // install, this intentionally 401s pre-login now — that's not an
        // error, it's the fix for kv_store having been fully readable/
        // writable by anyone unauthenticated. The real data hydration for
        // an already-seeded install happens in doLogin(), right after a
        // successful sign-in, via DB.reinit().
        DB.init()
          .then(() => {
            OLLAMA_MODEL = "llama3.2";
            DB.set("ollama_model", "llama3.2");
            webSecState = Object.assign(webSecState, DB.get("websec_state") || {});
            blacklistState = Object.assign(blacklistState, DB.get("blacklist_state") || {});
            seedDatabase();
            // Sync all existing accounts to linked roster entries (one-time migration)
            runAccountSyncMigration();
            document.getElementById("pw").placeholder = "Student123";
          })
          .catch((e) => {
            if (!e.isAuthRequired) {
              console.error("[DB] Could not reach the database server:", e);
            }
          })
          .finally(() => {
            updateDbBadge();
          });
      })();

      // ══════════════════════════════════════════════════════
      // ─── AI ASSISTANT (Ollama Integration) ───────────────
      // ══════════════════════════════════════════════════════
      // NOTE: this used to be "http://localhost:11434", fetched straight from
      // the browser. That only ever worked for someone sitting at the exact
      // machine running Ollama — everyone else's browser resolves
      // "localhost" to their OWN device (which has no Ollama), so the AI
      // Monitor always reported offline and translation always silently
      // failed for them, regardless of Ollama's real status. Requests now go
      // through this app's own backend (server.js), which runs right next to
      // Ollama and proxies these calls through — see the /api/ollama/*
      // route there.
      const OLLAMA_URL = "/api/ollama";
      // Mutable + persisted so the admin's model choice survives a page
      // reload. Falls back to the original default if nothing was saved yet.
      let OLLAMA_MODEL = "llama3.2"; // real saved value loaded by bootApp() once DB.init() resolves
      // Every model folder present under Ollama's local models directory on
      // this machine — populates the model-switcher dropdown in AI Monitor.
      const OLLAMA_AVAILABLE_MODELS = [
        "deepseek-r1",
        "gemma4",
        "llama3",
        "llama3.2",
        "phi4-mini",
        "qwen2.5-coder",
        "qwen2.5vl",
        "qwen2-math",
        "qwen3",
        "qwen3.5",
      ];

      // ─── Live installed-model cache (all parameter sizes) ──────────
      // OLLAMA_AVAILABLE_MODELS above only lists model *families* (what
      // the AI Monitor dropdown offers / what capability-routing keys
      // off). It says nothing about which specific parameter-size tag
      // is actually sitting on disk for each family — e.g. `ollama pull
      // qwen3:8b` only creates a "qwen3:8b" tag, not "qwen3:latest", so
      // asking Ollama to run bare "qwen3" would 404 even though the
      // family is clearly installed. This cache holds every tag Ollama
      // actually reports (via /api/tags), across every parameter size
      // pulled for every family, so a family name can always be
      // resolved to a real, runnable model string.
      let OLLAMA_LIVE_MODELS = []; // [{ name:"qwen3:8b", family:"qwen3", tagSuffix:"8b", paramB:8 }, ...]

      function parseModelTag(m) {
        const fullName = (m && (m.name || m.model)) || "";
        const idx = fullName.indexOf(":");
        const family = (idx === -1 ? fullName : fullName.slice(0, idx)).toLowerCase();
        const tagSuffix = idx === -1 ? "" : fullName.slice(idx + 1).toLowerCase();
        // Prefer Ollama's own reported parameter_size ("8.0B", "600M")
        // when present — more reliable than guessing from the tag text.
        let paramB = null;
        const detailSize = m && m.details && m.details.parameter_size;
        if (detailSize) {
          const dm = String(detailSize).match(/^([\d.]+)\s*([bm])/i);
          if (dm) paramB = /m/i.test(dm[2]) ? parseFloat(dm[1]) / 1000 : parseFloat(dm[1]);
        }
        if (paramB === null) {
          const tm = tagSuffix.match(/(\d+(?:\.\d+)?)\s*b\b/);
          if (tm) paramB = parseFloat(tm[1]);
        }
        return { name: fullName, family, tagSuffix, paramB };
      }

      // Called every time we get a fresh /api/tags response (status
      // polling, model switching, on-demand refresh) so the cache never
      // goes stale for longer than the next check.
      function updateLiveModelCache(models) {
        if (Array.isArray(models)) OLLAMA_LIVE_MODELS = models.map(parseModelTag);
      }

      // Given a model family (e.g. "qwen3" — with or without a tag),
      // searches across every parameter size actually installed for
      // that family and returns the exact tag Ollama should be asked to
      // run. Preference: an explicit "latest" tag, otherwise the
      // largest parameter size on disk, otherwise whatever was found.
      // Returns null if nothing for that family is installed at all.
      function resolveOllamaModelTag(family) {
        if (!family) return null;
        const fam = family.toLowerCase().split(":")[0];
        const candidates = OLLAMA_LIVE_MODELS.filter((m) => m.family === fam);
        if (!candidates.length) return null;
        const latest = candidates.find((m) => m.tagSuffix === "latest" || m.tagSuffix === "");
        if (latest) return latest.name;
        const sized = candidates.filter((m) => m.paramB !== null).sort((a, b) => b.paramB - a.paramB);
        if (sized.length) return sized[0].name;
        return candidates[0].name;
      }

      // ─── Per-model parameter profiles ──────────────────────────────
      // Each entry maps a model name to its ideal Ollama `options` block.
      // Keys mirror Ollama's documented generate options:
      //   temperature  – randomness (0 = deterministic, 1 = creative)
      //   num_predict  – max tokens to generate per response
      //   num_ctx      – context window size (tokens)
      //   top_p        – nucleus sampling threshold
      //   top_k        – top-k sampling
      //   repeat_penalty – penalise recently-used tokens
      //
      // Profiles are intentionally conservative: the defaults below reflect
      // each model's sweet-spot, not its absolute ceiling.
      const MODEL_PARAMS = {
        "deepseek-r1":     { temperature: 0.6, num_predict: 1024, num_ctx: 8192,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1  },
        "gemma4":          { temperature: 0.7, num_predict: 1024, num_ctx: 8192,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.05 },
        "llama3":          { temperature: 0.7, num_predict: 512,  num_ctx: 4096,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1  },
        "llama3.2":        { temperature: 0.7, num_predict: 512,  num_ctx: 4096,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1  },
        "phi4-mini":       { temperature: 0.7, num_predict: 512,  num_ctx: 4096,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.05 },
        "qwen2.5-coder":   { temperature: 0.3, num_predict: 1024, num_ctx: 8192,  top_p: 0.95, top_k: 50,  repeat_penalty: 1.05 },
        "qwen2.5vl":       { temperature: 0.7, num_predict: 768,  num_ctx: 8192,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.05 },
        "qwen2-math":      { temperature: 0.2, num_predict: 1024, num_ctx: 4096,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.0  },
        "qwen3":           { temperature: 0.7, num_predict: 1024, num_ctx: 8192,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.05 },
        "qwen3.5":         { temperature: 0.7, num_predict: 1024, num_ctx: 8192,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.05 },
      };

      // Default fallback for models not in MODEL_PARAMS.
      const MODEL_PARAMS_DEFAULT = { temperature: 0.7, num_predict: 512, num_ctx: 4096, top_p: 0.9, top_k: 40, repeat_penalty: 1.1 };

      // ─── AI chat file/picture attachments ──────────────────────────
      // Which installed models can actually SEE an attached picture.
      // Only "vl" (vision-language) tagged models accept the Ollama
      // `images` field on /api/generate — every other model in
      // OLLAMA_AVAILABLE_MODELS here is text-only, so an image sent to
      // them would just be silently ignored by Ollama. Re-evaluate this
      // list any time a model is added/removed from OLLAMA_AVAILABLE_MODELS.
      const VISION_CAPABLE_MODELS = ["qwen2.5vl"];

      // Extensions that are always rejected, regardless of file size —
      // anything that the OS can directly execute or a shell/interpreter
      // can run unattended. Source-code files students legitimately submit
      // for CS classes (.py, .js, .java, .c, .cpp, .html) are intentionally
      // NOT on this list — they aren't run just by being opened/attached.
      const BLOCKED_EXECUTABLE_EXTENSIONS = [
        "exe", "bat", "cmd", "com", "msi", "msp", "scr", "jar",
        "vbs", "vbe", "vb", "ws", "wsf", "wsh", "ps1", "ps2", "psc1",
        "psm1", "reg", "dll", "sys", "drv", "cpl", "gadget",
        "application", "appref-ms", "lnk", "pif", "scf", "inf",
        "apk", "ipa", "app", "deb", "rpm", "run", "bin", "out", "elf",
        "so", "dylib", "workflow", "action", "command", "sh", "bash",
        "zsh", "csh", "ksh", "msu", "job", "vxd", "hta", "jse", "shs",
      ];
      // Archive formats: zip/tar/gz/tgz are fully supported — the server
      // safely extracts a file listing and, for small text files, their
      // actual content (see /api/documents/parse), without ever executing
      // anything inside the archive. Formats without a safe pure-JS
      // extractor (rar/7z/iso/cab) are still allowed to attach — they just
      // fall through to filename-only, same as any other unparseable
      // document type, instead of being rejected outright.
      const FULLY_SUPPORTED_ARCHIVE_EXTENSIONS = ["zip", "tar", "gz", "tgz"];
      // Pictures — routed to a vision-capable model.
      const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];
      // Plain-text-ish documents — small enough & safe enough to read the
      // actual content of client-side and drop into the AI's prompt.
      const TEXT_ATTACHMENT_EXTENSIONS = ["txt", "csv", "json", "md", "log", "tsv"];
      const MAX_ATTACHMENT_BYTES = 1 * 1024 * 1024 * 1024; // 1GB

      let pendingAIAttachment = null; // { name, ext, size, kind: 'image'|'text'|'binary', data, mime }

      function getFileExtension(filename) {
        const m = /\.([a-z0-9]+)$/i.exec(filename || "");
        return m ? m[1].toLowerCase() : "";
      }

      function triggerAIAttach() {
        const inp = document.getElementById("ai-file-input");
        if (inp) inp.click();
      }

      function renderAIAttachmentChip() {
        const row = document.getElementById("ai-attachment-row");
        const btn = document.getElementById("ai-attach-btn");
        if (!row) return;
        if (!pendingAIAttachment) {
          row.classList.remove("show");
          row.innerHTML = "";
          if (btn) btn.classList.remove("has-file");
          return;
        }
        const icon = pendingAIAttachment.kind === "image" ? "🖼️" : "📄";
        row.classList.add("show");
        row.innerHTML = `
          <div class="ai-attachment-chip">
            <span>${icon}</span>
            <span class="chip-name">${escapeHtml(pendingAIAttachment.name)}</span>
            <button class="chip-remove" onclick="removeAIAttachment()" title="Remove attachment">×</button>
          </div>`;
        if (btn) btn.classList.add("has-file");
      }

      function removeAIAttachment() {
        pendingAIAttachment = null;
        const inp = document.getElementById("ai-file-input");
        if (inp) inp.value = "";
        renderAIAttachmentChip();
      }

      // Document types the server CAN parse into text — sent to
      // /api/documents/parse. Anything else (legacy .doc, .pptx,
      // rar/7z/iso/cab archives, etc.) falls back to filename-only,
      // since there's no safe parser for it.
      const PARSEABLE_DOCUMENT_EXTENSIONS = ["pdf", "docx", "xlsx", "xls", ...FULLY_SUPPORTED_ARCHIVE_EXTENSIONS];

      async function parseDocumentAttachment(file, ext) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(String(e.target.result).split(",")[1] || "");
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });

        const resp = await fetch("/api/documents/parse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + (window._authToken || ""),
          },
          body: JSON.stringify({ fileName: file.name, ext, dataBase64: base64 }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.error || "Parse failed");
        return data;
      }

      function handleAIAttachment(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        const ext = getFileExtension(file.name);

        if (BLOCKED_EXECUTABLE_EXTENSIONS.includes(ext)) {
          showToast(`."${ext}" files aren't allowed — executable/script formats are blocked for security`, "err");
          input.value = "";
          return;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          showToast(`File too large — max ${(MAX_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0)}MB`, "err");
          input.value = "";
          return;
        }

        const isImage = IMAGE_EXTENSIONS.includes(ext) || file.type.startsWith("image/");
        const isText = TEXT_ATTACHMENT_EXTENSIONS.includes(ext);

        if (isImage) {
          // Only offer this if some installed model can actually see it.
          const visionInstalled = VISION_CAPABLE_MODELS.some((m) => isModelFamilyInstalled(m));
          if (!visionInstalled) {
            showToast("No vision-capable AI model is installed, so pictures can't be analysed right now", "err");
            input.value = "";
            return;
          }
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target.result;
            const base64 = dataUrl.split(",")[1] || "";
            pendingAIAttachment = {
              name: file.name,
              ext,
              size: file.size,
              kind: "image",
              data: base64,
              mime: file.type || "image/" + ext,
            };
            renderAIAttachmentChip();
          };
          reader.onerror = () => showToast("Couldn't read that image", "err");
          reader.readAsDataURL(file);
        } else if (isText) {
          const reader = new FileReader();
          reader.onload = (e) => {
            pendingAIAttachment = {
              name: file.name,
              ext,
              size: file.size,
              kind: "text",
              data: String(e.target.result || "").slice(0, 12000), // keep prompts sane
            };
            renderAIAttachmentChip();
          };
          reader.onerror = () => showToast("Couldn't read that file", "err");
          reader.readAsText(file);
        } else if (PARSEABLE_DOCUMENT_EXTENSIONS.includes(ext)) {
          showToast(`Reading "${file.name}"…`, "ok");
          parseDocumentAttachment(file, ext)
            .then((result) => {
              pendingAIAttachment = {
                name: file.name,
                ext,
                size: file.size,
                kind: "text",
                data: result.text,
              };
              renderAIAttachmentChip();
              if (result.truncated) {
                showToast(`"${file.name}" was long — only the first part will be shared with the AI`, "warn");
              }
            })
            .catch((err) => {
              // Fall back to filename-only so the send flow never breaks,
              // just tell the user why the content itself isn't included.
              pendingAIAttachment = { name: file.name, ext, size: file.size, kind: "binary", data: null };
              renderAIAttachmentChip();
              showToast(`Couldn't read "${file.name}": ${err.message}`, "err");
            });
        } else {
          // Other document types (legacy .doc, .pptx, etc.) — we accept
          // the attachment so it travels with the message, but there's no
          // parser for this format, so only the filename (not the
          // contents) can be shared with the AI.
          pendingAIAttachment = {
            name: file.name,
            ext,
            size: file.size,
            kind: "binary",
            data: null,
          };
          renderAIAttachmentChip();
          showToast(`Attached "${file.name}" — note: only the filename can be shared with the AI, not its contents`, "warn");
        }
        input.value = "";
      }

      /**
       * Returns the Ollama `options` block for the given model name,
       * merging the per-model profile with any caller overrides.
       *
       * @param {string} [modelName]  – defaults to OLLAMA_MODEL
       * @param {object} [overrides]  – e.g. { temperature: 0, num_predict: 80 }
       * @returns {object}
       */
      function getModelOptions(modelName, overrides) {
        const base = MODEL_PARAMS[modelName || OLLAMA_MODEL] || MODEL_PARAMS_DEFAULT;
        return Object.assign({}, base, overrides || {});
      }

      // Models fine-tuned narrowly for one task (math notation, code)
      // trade away general-purpose language ability to get there, so they
      // translate ordinary page content poorly or not at all. Warn the
      // admin if they manually pick one of these while a non-English
      // language is active — the switch still goes through, this is just
      // a heads-up, not a block.
      const MODELS_WITH_LIMITED_TRANSLATION = ["qwen2-math", "qwen2.5-coder"];

      let ollamaModelSwitching = false; // guards the dropdown against double-submits mid-switch

      // ─── Task-based auto-routing ────────────────────────────────────
      // If a message needs a capability the *current* model isn't well
      // suited for, we hop to a better-equipped installed model for that
      // one request — automatically, with no admin action required.
      // Preference order matters: first installed entry wins.
      const MODEL_CAPABILITY_PREFERENCE = {
        // deepseek-r1: complex math, logic, step-by-step
        // qwen2-math: specialized academic math
        math: ["qwen2-math", "deepseek-r1", "qwen3.5", "qwen3"],
        // qwen2.5vl: image/visual understanding
        vision: ["qwen2.5vl"],
        // qwen2.5-coder: write/debug/explain code
        code: ["qwen2.5-coder", "deepseek-r1", "qwen3.5"],
        // deepseek-r1: deep thinking, multi-step reasoning
        reasoning: ["deepseek-r1", "qwen3.5", "qwen3"],
        // phi4-mini: fast everyday text tasks on limited hardware
        fast: ["phi4-mini", "llama3.2", "llama3"],
      };
      const CAPABILITY_LABELS = {
        math: "complex equation / math request detected",
        vision: "image-related request detected",
        code: "programming / code request detected",
        reasoning: "multi-step reasoning request detected",
        fast: "simple/quick task — routing to lightweight model",
      };

      // Lightweight local heuristics — no extra model/network call just to
      // decide whether a switch is worth it. Returns one of the keys in
      // MODEL_CAPABILITY_PREFERENCE, or null for an ordinary message
      // (ordinary messages never trigger an auto-switch).
      //
      // Detection order matters: more specific checks run first so a
      // message about "debugging a math formula in Python" hits "code"
      // rather than a broader bucket.
      function detectRequiredCapability(text) {
        const t = text.toLowerCase();

        // ── 1. VISION ────────────────────────────────────────────────────
        // Fires when user references a visual or asks to read from an image/chart.
        if (
          /\b(this|the|attached|uploaded|following|given|above|below)\s+(image|photo|picture|screenshot|diagram|chart|graph|figure|table|scan)\b/.test(t) ||
          /\b(read|extract|ocr|parse|describe|analyse|analyze|identify|detect)\s+.{0,30}(image|photo|picture|screenshot|diagram|chart|graph|figure|table)\b/.test(t) ||
          /\bwhat('s| is| does| do| are)\s+.{0,20}(image|photo|picture|chart|graph|diagram)\b/.test(t) ||
          /\bvisual\s+(data|analysis|recognition|understanding)\b/.test(t)
        ) {
          return "vision";
        }

        // ── 2. MATH ──────────────────────────────────────────────────────
        // Equation-heavy notation OR explicit academic math vocabulary.
        const mathSymbolHits = (text.match(/[√∫∑∏±∂∇∞≤≥≠]|\\frac|\\sqrt|\\int|\\sum|\^{|\bmod\b|\bln\b/g) || []).length;
        const mathWordHits = (
          t.match(
            /\b(solve|equation|derivative|integral|simplify|factor(ise|ize)?|algebra|calculus|matrix|quadratic|logarithm|trigonometry|differentiat\w*|integrat\w*|eigenvalue|eigenvector|determinant|polynomial|binomial|probability|statistics|variance|standard deviation|hypothesis|regression|gradient descent|fourier|laplace|complex number|imaginary number|modular arithmetic|number theory|combinatorics|permutation|prime number)\b/g,
          ) || []
        ).length;
        if (mathSymbolHits >= 1 || mathWordHits >= 1) {
          return "math";
        }

        // ── 3. CODE ──────────────────────────────────────────────────────
        // Programming requests: writing, debugging, explaining code.
        if (
          /```/.test(text) ||
          /\b(debug|fix (the |this |my )?(bug|code|error|issue)|stack trace|syntax error|compile error|runtime error|refactor|regex|api endpoint|null pointer|segfault|segmentation fault|type error|undefined variable|index out of bounds)\b/.test(t) ||
          /\b(write|create|build|implement|generate)\s+.{0,30}(function|script|class|module|component|api|endpoint|query|algorithm|program|app|bot)\b/.test(t) ||
          /\b(how (do i|to)|what('s| is) the (syntax|best way))\s+.{0,30}(in (python|javascript|java|c\+\+|c#|php|ruby|go|rust|typescript|html|css|sql|mysql|bash|shell|kotlin|swift))\b/.test(t) ||
          /\b(def |class |import |console\.log|print\(|printf|public static|var |let |const |return |function |=>|async |await )\b/.test(text) ||
          /\b(git|docker|npm|pip|yarn|webpack|vite|bash script|shell script|linux command)\b/.test(t)
        ) {
          return "code";
        }

        // ── 4. DEEP REASONING ────────────────────────────────────────────
        // Complex logic, multi-step problem-solving, critical analysis.
        if (
          /\b(step[- ]by[- ]step|prove (that|this|it)|walk me through|reason(ing)? through|think through|analyse (this|the|my)|analyze (this|the|my)|break (this|it) down|logical(ly)?|deduc(e|tion)|infer(ence)?|critically (think|analyse|evaluate)|thought experiment|first principles|chain of thought|work through|pros and cons|trade[- ]?offs|compare and contrast)\b/.test(t) ||
          /\b(what (are|is) the (implications|consequences|impact|effect|cause)|why (does|do|did|is|are)\b.{5,50}(happen|occur|work|fail|matter))\b/.test(t)
        ) {
          return "reasoning";
        }

        // ── 5. FAST / LIGHTWEIGHT ────────────────────────────────────────
        // Very short, simple messages needing a quick turnaround.
        const wordCount = t.trim().split(/\s+/).length;
        if (
          wordCount <= 8 &&
          /\b(hi|hello|hey|thanks|thank you|ok|okay|yes|no|what time|what date|translate|define|meaning of|synonym|antonym|spell|grammar|fix (this|my) sentence|rephrase)\b/.test(t)
        ) {
          return "fast";
        }

        // ── 6. GENERAL / CREATIVE ────────────────────────────────────────
        // Everything else: conversation, creative writing, summarization —
        // the base general models handle these well, so no switch needed.
        return null;
      }

      // True once the live cache confirms a family is actually installed
      // (any parameter size). Before the very first /api/tags poll has
      // completed (e.g. the instant the page loads), falls back to the
      // static known-families list so routing isn't blind for that
      // brief window.
      function isModelFamilyInstalled(family) {
        if (OLLAMA_LIVE_MODELS.length) {
          return OLLAMA_LIVE_MODELS.some((m) => m.family === family.toLowerCase());
        }
        return OLLAMA_AVAILABLE_MODELS.includes(family);
      }

      // Given a detected capability, picks the best *installed* model for
      // it — but only if the model currently running isn't already a good
      // fit. Returns null when no switch is needed/possible.
      function pickBetterModelFor(capability) {
        const prefs = MODEL_CAPABILITY_PREFERENCE[capability];
        if (!prefs) return null;
        if (prefs.includes(OLLAMA_MODEL)) return null; // current model already handles this fine
        for (const m of prefs) {
          if (isModelFamilyInstalled(m)) return m;
        }
        return null; // nothing better-suited is installed — stay put
      }
      let aiOpen = false;
      let aiConnected = false;
      let aiChecking = false;
      let aiMessageHistory = [];
      // ── Diagnostics conversation log ─────────────────────────────────
      // Each entry: { ts, user, role, model, msgSnippet, replySnippet, runtimeMs }
      // Capped at 50 entries (oldest dropped first). Never persisted to DB —
      // this is a live session view for the admin, not a permanent record.
      let diagLog = [];
      const AI_RATE_LIMIT_MS = 0;
      let lastAIMessageTime = 0;
      let aiStats = {
        totalMessages: 0,
        totalTokens: 0,
        errors: 0,
        lastError: null,
        uptime: 0,
        startTime: Date.now(),
        messagesByUser: {},
        dailyStats: {},
      };

