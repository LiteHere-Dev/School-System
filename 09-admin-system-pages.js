      // ══════════════════════════════════════════════════════
      // ─── V162: SYSTEM HEALTH PAGE ──────────────────────────
      // ══════════════════════════════════════════════════════
      let sysHealthPollTimer = null;

      function startSysHealthPolling() {
        fetchSysHealth();
        fetchDbHealth();
        fetchTimeline();
        fetchErrorLog();
        if (!sysHealthPollTimer) sysHealthPollTimer = setInterval(() => { fetchSysHealth(); fetchDbHealth(); }, 15000);
      }

      function stopSysHealthPolling() {
        if (sysHealthPollTimer) { clearInterval(sysHealthPollTimer); sysHealthPollTimer = null; }
      }

      async function fetchSysHealth() {
        try {
          const r = await fetch("/api/system/health");
          const data = await r.json();
          const el = document.getElementById("syshealth-server-card");
          if (!el) return;
          const memPct = Math.round((data.memory.heap_used_mb / data.memory.heap_total_mb) * 100);
          el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
              ${sysStatCard("🟢 Status", data.status === "ok" ? "Healthy" : "⚠️ Issue", "var(--green)")}
              ${sysStatCard("⏱ Uptime", data.uptime_human, "var(--navy)")}
              ${sysStatCard("🧠 Heap Used", data.memory.heap_used_mb + " MB", memPct > 80 ? "var(--crimson)" : "var(--navy)")}
              ${sysStatCard("📦 RSS", data.memory.rss_mb + " MB", "var(--navy)")}
              ${sysStatCard("🔧 Node", data.node_version, "var(--navy-mid)")}
              ${sysStatCard("🖥 Platform", data.platform, "var(--navy-mid)")}
            </div>
            <div style="margin-top:12px;font-size:11px;color:var(--ink-35)">Started: ${new Date(data.started_at).toLocaleString("en-GB")} · PID ${data.pid}</div>
          `;
        } catch (e) {
          const el = document.getElementById("syshealth-server-card");
          if (el) el.innerHTML = `<div style="color:var(--crimson)">⚠️ Could not reach server health endpoint</div>`;
        }
      }

      async function fetchDbHealth() {
        const el = document.getElementById("syshealth-db-card");
        if (!el) return;
        try {
          const r = await fetch("/api/system/db-health", { headers: { Authorization: "Bearer " + (window._authToken || "") } });
          const data = await r.json();
          const tables = (data.tables || []).map(t =>
            `<tr><td style="padding:4px 8px">${escapeHtml(t.table_name)}</td><td style="padding:4px 8px;text-align:right">${Number(t.live_rows).toLocaleString()}</td><td style="padding:4px 8px;text-align:right;color:var(--ink-35)">${t.total_size}</td></tr>`
          ).join("");
          el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">
              ${sysStatCard("📡 Ping", data.ping_ms + " ms", data.ping_ms < 50 ? "var(--green)" : "var(--crimson)")}
              ${sysStatCard("💾 DB Size", data.db_size, "var(--navy)")}
              ${sysStatCard("🔗 Connections", data.connections?.total + " total", "var(--navy)")}
              ${sysStatCard("🔒 Blocked Locks", data.blocked_locks, data.blocked_locks > 0 ? "var(--crimson)" : "var(--green)")}
            </div>
            <div style="font-size:12px;font-weight:600;color:var(--navy);margin-bottom:6px">Table Sizes</div>
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead><tr class="syshealth-timeline-badge" style="font-size:11px">
                  <th style="padding:4px 8px;text-align:left">Table</th>
                  <th style="padding:4px 8px;text-align:right">Rows</th>
                  <th style="padding:4px 8px;text-align:right">Size</th>
                </tr></thead>
                <tbody>${tables}</tbody>
              </table>
            </div>
            <div style="margin-top:8px;font-size:11px;color:var(--ink-35)">Checked: ${new Date(data.checked_at).toLocaleTimeString("en-GB")}</div>
          `;
        } catch (e) {
          el.innerHTML = `<div style="color:var(--crimson)">⚠️ DB health unavailable</div>`;
        }
      }

      async function fetchTimeline(categoryFilter, severityFilter) {
        const el = document.getElementById("syshealth-timeline");
        if (!el) return;
        let url = "/api/system/timeline?limit=50";
        if (categoryFilter) url += "&category=" + encodeURIComponent(categoryFilter);
        if (severityFilter)  url += "&severity="  + encodeURIComponent(severityFilter);
        try {
          const r = await fetch(url, { headers: { Authorization: "Bearer " + (window._authToken || "") } });
          const rows = await r.json();
          if (!rows.length) { el.innerHTML = `<div style="color:var(--ink-35);font-size:13px;padding:20px;text-align:center">No activity recorded yet.</div>`; return; }
          el.innerHTML = rows.map(ev => {
            const sev = ev.severity || "info";
            const sevColor = sev === "error" ? "var(--crimson)" : sev === "warn" ? "#c97a00" : "var(--navy-mid)";
            const sevDot   = sev === "error" ? "🔴" : sev === "warn" ? "🟡" : "🟢";
            const details  = ev.details ? Object.entries(typeof ev.details === "string" ? JSON.parse(ev.details) : ev.details)
              .map(([k,v]) => `<span style="margin-right:8px;color:var(--ink-50)">${k}: <b>${escapeHtml(String(v))}</b></span>`).join("") : "";
            return `
              <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                <div style="font-size:16px;line-height:1;padding-top:2px">${sevDot}</div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span style="font-weight:600;font-size:12px;color:${sevColor}">${escapeHtml(ev.event_type)}</span>
                    <span style="font-size:11px;color:var(--ink-35);border-radius:4px;padding:1px 6px" class="syshealth-timeline-badge">${escapeHtml(ev.category)}</span>
                    ${ev.actor ? `<span style="font-size:11px;color:var(--ink-50)">by ${escapeHtml(ev.actor)}</span>` : ""}
                  </div>
                  ${details ? `<div style="margin-top:2px;font-size:11px">${details}</div>` : ""}
                </div>
                <div style="font-size:10px;color:var(--ink-35);white-space:nowrap;padding-top:2px">${new Date(ev.created_at).toLocaleTimeString("en-GB", {hour:"2-digit",minute:"2-digit"})}<br>${new Date(ev.created_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</div>
              </div>`;
          }).join("");
        } catch (e) {
          el.innerHTML = `<div style="color:var(--crimson)">⚠️ Could not load timeline</div>`;
        }
      }

      async function fetchErrorLog(levelFilter, resolvedFilter) {
        const el = document.getElementById("syshealth-errors");
        if (!el) return;
        let url = "/api/system/errors?limit=50";
        if (levelFilter)    url += "&level="    + encodeURIComponent(levelFilter);
        if (resolvedFilter !== undefined) url += "&resolved=" + resolvedFilter;
        try {
          const r = await fetch(url, { headers: { Authorization: "Bearer " + (window._authToken || "") } });
          const rows = await r.json();
          if (!rows.length) { el.innerHTML = `<div style="color:var(--green);font-size:13px;padding:20px;text-align:center">✅ No errors logged.</div>`; return; }
          el.innerHTML = rows.map(ev => {
            const lvlColor = ev.level === "error" ? "var(--crimson)" : ev.level === "warn" ? "#c97a00" : "var(--navy-mid)";
            return `
              <div style="padding:10px 0;border-bottom:1px solid var(--border);${ev.resolved ? 'opacity:0.5' : ''}">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-size:11px;font-weight:700;color:${lvlColor};background:${ev.level==='error'?'rgba(180,30,30,0.08)':ev.level==='warn'?'rgba(180,120,0,0.08)':'rgba(30,60,120,0.06)'};border-radius:4px;padding:2px 7px;text-transform:uppercase">${ev.level}</span>
                  <span style="font-size:11px;color:var(--ink-35);border-radius:4px;padding:1px 6px" class="syshealth-timeline-badge">${escapeHtml(ev.source)}</span>
                  ${ev.resolved ? `<span style="font-size:11px;color:var(--green)">✓ Resolved</span>` : `<button onclick="resolveError(${ev.id})" class="syshealth-resolve-btn" style="font-size:10px;padding:2px 8px;border-radius:4px;background:none;cursor:pointer">Resolve</button>`}
                  <span style="margin-left:auto;font-size:10px;color:var(--ink-35)">${new Date(ev.created_at).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <div style="margin-top:4px;font-size:12px;color:var(--ink-70)">${escapeHtml(ev.message)}</div>
                ${ev.stack ? `<details style="margin-top:4px"><summary style="font-size:11px;color:var(--ink-35);cursor:pointer">Stack trace</summary><pre class="syshealth-stack" style="font-size:10px;overflow-x:auto;margin:4px 0;color:var(--ink-50)">${escapeHtml(ev.stack.slice(0,600))}</pre></details>` : ""}
              </div>`;
          }).join("");
        } catch (e) {
          el.innerHTML = `<div style="color:var(--crimson)">⚠️ Could not load error log</div>`;
        }
      }

      async function resolveError(id) {
        try {
          await fetch("/api/system/errors/" + id + "/resolve", { method: "PATCH", headers: { Authorization: "Bearer " + (window._authToken || "") } });
          fetchErrorLog();
        } catch(e) { showToast("Failed to resolve error"); }
      }

      function sysStatCard(label, value, color) {
        return `<div class="syshealth-stat">
          <div class="syshealth-stat-label">${label}</div>
          <div style="font-size:16px;font-weight:700;color:${color}">${value}</div>
        </div>`;
      }

      function adminSysHealth() {
        setTimeout(() => { fetchSysHealth(); fetchDbHealth(); fetchTimeline(); fetchErrorLog(); }, 50);
        return `
          <div class="inner" style="max-width:1100px">
            <div class="ph" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div><h2>System <em>Health</em></h2><p>Server, database, activity timeline, and error log — auto-refreshes every 15 s</p></div>
              <button class="btn btn-ghost" style="font-size:12px" onclick="fetchSysHealth();fetchDbHealth();fetchTimeline();fetchErrorLog()">↻ Refresh</button>
            </div>

            <!-- Server health -->
            <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:8px">🖥 Server</div>
            <div id="syshealth-server-card" class="syshealth-card">
              <div style="color:var(--ink-35);font-size:13px">Loading…</div>
            </div>

            <!-- DB health -->
            <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:8px">🗄 Database</div>
            <div id="syshealth-db-card" class="syshealth-card">
              <div style="color:var(--ink-35);font-size:13px">Loading…</div>
            </div>

            <!-- Activity timeline -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
              <div style="font-size:13px;font-weight:700;color:var(--navy)">📋 Activity Timeline</div>
              <select class="fselect" style="font-size:11px;padding:3px 8px;min-width:120px" onchange="fetchTimeline(this.value||undefined)">
                <option value="">All categories</option>
                <option value="auth">Auth</option>
                <option value="backup">Backup</option>
                <option value="database">Database</option>
                <option value="system">System</option>
              </select>
              <select class="fselect" style="font-size:11px;padding:3px 8px;min-width:100px" onchange="fetchTimeline(undefined,this.value||undefined)">
                <option value="">All severity</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div id="syshealth-timeline" class="syshealth-card" style="max-height:400px;overflow-y:auto">
              <div style="color:var(--ink-35);font-size:13px">Loading…</div>
            </div>

            <!-- Error log -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
              <div style="font-size:13px;font-weight:700;color:var(--navy)">🚨 Error Log</div>
              <select class="fselect" style="font-size:11px;padding:3px 8px;min-width:110px" onchange="fetchErrorLog(this.value||undefined)">
                <option value="">All levels</option>
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
              </select>
              <select class="fselect" style="font-size:11px;padding:3px 8px;min-width:130px" onchange="fetchErrorLog(undefined,this.value==='all'?undefined:this.value)">
                <option value="all">All</option>
                <option value="false">Unresolved only</option>
                <option value="true">Resolved only</option>
              </select>
            </div>
            <div id="syshealth-errors" class="syshealth-card" style="max-height:400px;overflow-y:auto">
              <div style="color:var(--ink-35);font-size:13px">Loading…</div>
            </div>
          </div>`;
      }

      // ══════════════════════════════════════════════════════
      // ─── V162: BACKUPS PAGE ────────────────────────────────
      // ══════════════════════════════════════════════════════
      function adminBackups() {
        setTimeout(loadBackups, 50);
        return `
          <div class="inner" style="max-width:900px">
            <div class="ph" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div><h2>Data <em>Backups</em></h2><p>Automatic daily snapshots of all data. Manual backups can be created anytime.</p></div>
              <button class="btn btn-navy" style="font-size:13px" onclick="runManualBackup()">＋ Create Backup Now</button>
            </div>
            <div id="backups-list">
              <div style="color:var(--ink-35);font-size:13px;padding:20px 0">Loading backups…</div>
            </div>
          </div>`;
      }

      async function loadBackups() {
        const el = document.getElementById("backups-list");
        if (!el) return;
        try {
          const r = await fetch("/api/backups", { headers: { Authorization: "Bearer " + (window._authToken || "") } });
          const rows = await r.json();
          if (!rows.length) {
            el.innerHTML = `<div style="color:var(--ink-35);font-size:13px;padding:20px;text-align:center">No backups yet. Create one now!</div>`;
            return;
          }
          el.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="background:var(--bg-alt);font-size:11px;color:var(--ink-35);text-transform:uppercase;letter-spacing:.5px">
                  <th style="padding:8px 12px;text-align:left">Label</th>
                  <th style="padding:8px 12px;text-align:right">Size</th>
                  <th style="padding:8px 12px;text-align:left">Created</th>
                  <th style="padding:8px 12px;text-align:left">Status</th>
                  <th style="padding:8px 12px;text-align:right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(b => {
                  const sizeFmt = b.size_bytes ? (b.size_bytes > 1048576 ? (b.size_bytes/1048576).toFixed(1)+" MB" : Math.round(b.size_bytes/1024)+" KB") : "—";
                  const isAuto  = b.id.startsWith("bk_auto");
                  return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:10px 12px">
                      <div style="font-weight:600;color:var(--navy)">${escapeHtml(b.label)}</div>
                      <div style="font-size:10px;color:var(--ink-35);margin-top:1px">${b.id} ${isAuto ? '· <span style="color:#3A7A5C">auto</span>' : '· <span style="color:var(--navy-mid)">manual</span>'}</div>
                    </td>
                    <td style="padding:10px 12px;text-align:right;color:var(--ink-50)">${sizeFmt}</td>
                    <td style="padding:10px 12px;color:var(--ink-50);font-size:12px">${new Date(b.created_at).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
                    <td style="padding:10px 12px"><span style="font-size:11px;font-weight:600;color:#3A7A5C;background:rgba(58,122,92,0.1);border-radius:4px;padding:2px 7px">${b.status}</span></td>
                    <td style="padding:10px 12px;text-align:right;white-space:nowrap">
                      <button onclick="restoreBackup('${b.id}','${escapeHtml(b.label).replace(/'/g,"\\'")}','${new Date(b.created_at).toLocaleString("en-GB")}')" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:5px;background:none;cursor:pointer;color:var(--crimson);margin-right:4px">↩ Restore</button>
                      <button onclick="deleteBackup('${b.id}')" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:5px;background:none;cursor:pointer;color:var(--ink-35)">🗑</button>
                    </td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>`;
        } catch(e) {
          el.innerHTML = `<div style="color:var(--crimson)">⚠️ Could not load backups: ${escapeHtml(e.message)}</div>`;
        }
      }

      async function runManualBackup() {
        const label = prompt("Backup label (leave blank for default):");
        if (label === null) return;
        showToast("Creating backup…");
        try {
          const r = await fetch("/api/backups/run", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + (window._authToken || "") },
            body: JSON.stringify({ label: label || undefined })
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || "Failed");
          showToast("✅ Backup created (" + (data.size_bytes ? Math.round(data.size_bytes/1024) + " KB" : "done") + ")");
          loadBackups();
        } catch(e) {
          showToast("⚠️ Backup failed: " + e.message);
        }
      }

      async function restoreBackup(id, label, date) {
        if (!confirm(`Restore backup:\n"${label}"\nCreated: ${date}\n\nThis will OVERWRITE current data for all keys in the backup. Continue?`)) return;
        showToast("Restoring…");
        try {
          const r = await fetch("/api/backups/restore/" + id, {
            method: "POST",
            headers: { Authorization: "Bearer " + (window._authToken || "") }
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || "Failed");
          showToast("✅ Restored " + data.rows_restored + " keys. Reload the page to see changes.");
        } catch(e) {
          showToast("⚠️ Restore failed: " + e.message);
        }
      }

      async function deleteBackup(id) {
        if (!confirm("Delete this backup? This cannot be undone.")) return;
        try {
          const r = await fetch("/api/backups/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + (window._authToken || "") } });
          if (!r.ok) throw new Error("Delete failed");
          showToast("Backup deleted");
          loadBackups();
        } catch(e) {
          showToast("⚠️ " + e.message);
        }
      }

      // ══════════════════════════════════════════════════════
      // ─── V162: MIGRATIONS PAGE ─────────────────────────────
      // ══════════════════════════════════════════════════════
      function adminMigrations() {
        setTimeout(loadMigrations, 50);
        return `
          <div class="inner" style="max-width:900px">
            <div class="ph" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div><h2>Database <em>Migrations</em></h2><p>Track and apply schema changes. Each migration has an optional rollback script.</p></div>
              <button class="btn btn-navy" style="font-size:13px" onclick="showNewMigrationModal()">＋ New Migration</button>
            </div>
            <div id="migrations-list">
              <div style="color:var(--ink-35);font-size:13px;padding:20px 0">Loading migrations…</div>
            </div>
          </div>

          <!-- New migration modal -->
          <div id="migration-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:none;align-items:center;justify-content:center">
            <div style="background:var(--card-bg);border-radius:12px;padding:28px;width:min(700px,95vw);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">
              <div style="font-size:16px;font-weight:700;color:var(--navy);margin-bottom:16px">New Database Migration</div>
              <div class="field" style="margin-bottom:12px">
                <label style="font-size:12px;font-weight:600;color:var(--ink-50)">Version (e.g. 008)</label>
                <input type="text" id="mig-version" class="field input" placeholder="008" style="margin-top:4px">
              </div>
              <div class="field" style="margin-bottom:12px">
                <label style="font-size:12px;font-weight:600;color:var(--ink-50)">Name</label>
                <input type="text" id="mig-name" class="field input" placeholder="add_notifications_table" style="margin-top:4px">
              </div>
              <div class="field" style="margin-bottom:12px">
                <label style="font-size:12px;font-weight:600;color:var(--ink-50)">SQL (UP — apply)</label>
                <textarea id="mig-sql-up" rows="6" style="width:100%;margin-top:4px;font-family:monospace;font-size:12px;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-alt);color:var(--ink-70);resize:vertical" placeholder="ALTER TABLE ..."></textarea>
              </div>
              <div class="field" style="margin-bottom:16px">
                <label style="font-size:12px;font-weight:600;color:var(--ink-50)">SQL (DOWN — rollback, optional)</label>
                <textarea id="mig-sql-down" rows="4" style="width:100%;margin-top:4px;font-family:monospace;font-size:12px;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-alt);color:var(--ink-70);resize:vertical" placeholder="ALTER TABLE ... (to reverse)"></textarea>
              </div>
              <div style="display:flex;gap:10px;justify-content:flex-end">
                <button class="btn btn-ghost" onclick="document.getElementById('migration-modal').style.display='none'">Cancel</button>
                <button class="btn btn-navy" onclick="applyMigration()">Apply Migration</button>
              </div>
            </div>
          </div>
        `;
      }

      async function loadMigrations() {
        const el = document.getElementById("migrations-list");
        if (!el) return;
        try {
          const r = await fetch("/api/migrations", { headers: { Authorization: "Bearer " + (window._authToken || "") } });
          const rows = await r.json();
          if (!rows.length) { el.innerHTML = `<div style="color:var(--ink-35);font-size:13px;padding:20px;text-align:center">No migrations recorded yet.</div>`; return; }
          el.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="background:var(--bg-alt);font-size:11px;color:var(--ink-35);text-transform:uppercase;letter-spacing:.5px">
                  <th style="padding:8px 12px;text-align:left">Ver</th>
                  <th style="padding:8px 12px;text-align:left">Name</th>
                  <th style="padding:8px 12px;text-align:left">Applied By</th>
                  <th style="padding:8px 12px;text-align:left">Applied At</th>
                  <th style="padding:8px 12px;text-align:left">Status</th>
                  <th style="padding:8px 12px;text-align:right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(m => `
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:10px 12px;font-weight:700;color:var(--navy);font-family:monospace">${escapeHtml(m.version)}</td>
                    <td style="padding:10px 12px;color:var(--ink-70)">${escapeHtml(m.name)}</td>
                    <td style="padding:10px 12px;color:var(--ink-50);font-size:12px">${escapeHtml(m.applied_by || "—")}</td>
                    <td style="padding:10px 12px;color:var(--ink-50);font-size:12px">${new Date(m.applied_at).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
                    <td style="padding:10px 12px">
                      ${m.rolled_back
                        ? `<span style="font-size:11px;font-weight:600;color:var(--crimson);background:rgba(180,30,30,0.08);border-radius:4px;padding:2px 7px">Rolled back</span>`
                        : `<span style="font-size:11px;font-weight:600;color:#3A7A5C;background:rgba(58,122,92,0.1);border-radius:4px;padding:2px 7px">Applied</span>`}
                    </td>
                    <td style="padding:10px 12px;text-align:right">
                      ${!m.rolled_back ? `<button onclick="rollbackMigration('${escapeHtml(m.version)}','${escapeHtml(m.name)}')" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:5px;background:none;cursor:pointer;color:var(--crimson)">↩ Rollback</button>` : ""}
                    </td>
                  </tr>`).join("")}
              </tbody>
            </table>`;
        } catch(e) {
          el.innerHTML = `<div style="color:var(--crimson)">⚠️ Could not load migrations: ${escapeHtml(e.message)}</div>`;
        }
      }

      function showNewMigrationModal() {
        const m = document.getElementById("migration-modal");
        if (m) m.style.display = "flex";
      }

      async function applyMigration() {
        const version  = document.getElementById("mig-version")?.value.trim();
        const name     = document.getElementById("mig-name")?.value.trim();
        const sql_up   = document.getElementById("mig-sql-up")?.value.trim();
        const sql_down = document.getElementById("mig-sql-down")?.value.trim();
        if (!version || !name || !sql_up) { showToast("Version, name and SQL (UP) are required"); return; }
        try {
          const r = await fetch("/api/migrations", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + (window._authToken || "") },
            body: JSON.stringify({ version, name, sql_up, sql_down: sql_down || null })
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || "Failed");
          showToast("✅ Migration v" + version + " applied");
          document.getElementById("migration-modal").style.display = "none";
          loadMigrations();
        } catch(e) {
          showToast("⚠️ Migration failed: " + e.message);
        }
      }

      async function rollbackMigration(version, name) {
        if (!confirm(`Roll back migration v${version} "${name}"?\n\nThis runs the DOWN SQL. It cannot be undone automatically.`)) return;
        try {
          const r = await fetch("/api/migrations/" + encodeURIComponent(version) + "/rollback", {
            method: "POST",
            headers: { Authorization: "Bearer " + (window._authToken || "") }
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || "Failed");
          showToast("↩ Migration v" + version + " rolled back");
          loadMigrations();
        } catch(e) {
          showToast("⚠️ Rollback failed: " + e.message);
        }
      }

      // V162 page data loads are triggered directly by adminBackups() and adminMigrations()
