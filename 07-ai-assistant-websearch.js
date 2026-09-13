      // ══════════════════════════════════════════════════════
      // ─── WEB SEARCH (security-gated tool access for the AI) ─
      // ══════════════════════════════════════════════════════
      // The AI may fetch information from the web ONLY when both are true:
      //   1) The browser has working internet access (checked live, not
      //      just navigator.onLine).
      //   2) The model itself judges that it doesn't already know the
      //      answer (a small, separate, temperature-0 classification call).
      // The model NEVER chooses a URL or endpoint — it can only produce a
      // short search query string, which this code sends to a single fixed
      // search endpoint. This removes SSRF / "fetch whatever I want" risk.
      // Every step is sanitized and screened for prompt-injection / SSRF
      // patterns. Anything that looks even remotely malicious immediately
      // kills the AI assistant, logs a CRITICAL audit entry, and alerts
      // whoever is at the screen — recovery requires an admin to clear it
      // from AI Monitor.

      const WEB_SEARCH_ENDPOINT = "https://api.duckduckgo.com/";
      const WEB_SEARCH_MAX_RESULTS = 4;
      const WEB_SEARCH_MAX_QUERY_LEN = 150;
      const WEB_SEARCH_MAX_SNIPPET_LEN = 300;
      const WEB_SEARCH_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
      const WEB_SEARCH_RATE_MAX = 8; // searches per window, shared across all users

      // Patterns that indicate an attempt to hijack the assistant's
      // instructions (prompt injection) — checked against both the model's
      // own search-query choice AND every piece of text pulled from the web.
      const PROMPT_INJECTION_PATTERNS = [
        /ignore\s+(all|any|every|the)?\s*(previous|prior|above|earlier)?\s*instructions?/i,
        /disregard\s+(all|any|every|the)?\s*(previous|prior|above|earlier)?\s*instructions?/i,
        /forget\s+(everything|all|your instructions|what i said)/i,
        /new\s+instructions\s*:/i,
        /system\s*prompt/i,
        /reveal\s+(your|the)\s+(system\s*)?prompt/i,
        /you\s+are\s+now\s+(a|an)\b/i,
        /act\s+as\s+(dan|a jailbroken|an unfiltered)/i,
        /<script[\s>]/i,
        /javascript\s*:/i,
        /on(error|load|click)\s*=/i,
        /eval\s*\(/i,
        /base64\s*,/i,
        /\bsudo\b/i,
        /exfiltrat/i,
        /send\s+(this|the|all)\s+(data|conversation|info)\s+to/i,
      ];

      // Patterns that indicate an attempt to make the search/fetch step
      // reach internal, local, or otherwise out-of-bounds network targets
      // (SSRF). Checked against the model's chosen query AND raw user text.
      const SSRF_PATTERNS = [
        /localhost/i,
        /127\.0\.0\.1/,
        /0\.0\.0\.0/,
        /169\.254\./,
        /::1\b/,
        /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
        /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
        /\b172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}\b/,
        /file\s*:\s*\/\//i,
        /ftp\s*:\s*\/\//i,
        /\b11434\b/, // Ollama's own port — block attempts at recursive/self-targeting requests
        /169\.254\.169\.254/, // cloud metadata endpoint
      ];

      // Patterns that indicate a request for genuinely dangerous content —
      // weapons, explosives, drug synthesis, or instructions for violence.
      // Checked directly against the user's own typed message, in addition
      // to the model's own [DANGEROUS_CONTENT_SHUTDOWN] self-reporting, so
      // detection doesn't depend entirely on the local model's compliance.
      const DANGEROUS_CONTENT_PATTERNS = [
        /how (do|can|would|to) .*\b(make|build|create|construct|assemble)\b.*\b(bomb|explosive|detonator|grenade|landmine|ied)\b/i,
        /\b(make|build|create|synthesi[sz]e)\b.*\b(bomb|explosive|nerve agent|chemical weapon|biological weapon|nuke|nuclear weapon)\b/i,
        /\b(synthesi[sz]e|cook|manufacture)\b.*\b(meth|methamphetamine|fentanyl|sarin|ricin|anthrax)\b/i,
        /how to (kill|murder|assassinate)\b/i,
      ];

      function detectMaliciousPattern(text) {
        if (!text || typeof text !== "string") return null;
        for (const p of PROMPT_INJECTION_PATTERNS) {
          if (p.test(text)) return "prompt_injection:" + p.source.slice(0, 40);
        }
        for (const p of SSRF_PATTERNS) {
          if (p.test(text)) return "ssrf_attempt:" + p.source.slice(0, 40);
        }
        return null;
      }

      // Persisted security/usage state for the web-search feature.
      // (Real saved values merged in by bootApp() once DB.init() resolves.)
      let webSecState = {
        enabled: true, // admin can flip this off entirely from AI Monitor
        killSwitch: false, // auto-set true on any malicious signal
        lockdownReason: null,
        lockdownAt: null,
        totalSearches: 0,
        blockedCount: 0,
        searchTimestamps: [],
        events: [], // {time, type, detail}
      };

      function saveWebSecState() {
        DB.set("websec_state", webSecState);
      }

      function logSecurityEvent(type, detail) {
        webSecState.events.unshift({ time: Date.now(), type, detail });
        if (webSecState.events.length > 200) webSecState.events.length = 200;
        saveWebSecState();
      }

      // Last line of defense: disable the AI assistant immediately,
      // record exactly why, and make sure an admin will see it.
      function triggerSecurityLockdown(reason, detail) {
        if (webSecState.killSwitch) return; // already locked down
        webSecState.killSwitch = true;
        webSecState.lockdownReason = reason;
        webSecState.lockdownAt = Date.now();
        logSecurityEvent("LOCKDOWN", reason + (detail ? " — " + detail : ""));
        saveWebSecState();
        addAuditLogEntry(
          "ai_security_lockdown",
          "AI-ASSISTANT",
          "AI Assistant",
          `🚨 AI assistant auto-disabled by security system: ${reason}${detail ? " (" + detail + ")" : ""}`,
        );
        showToast(
          "🚨 Security alert — AI assistant disabled. Admin has been notified.",
          "err",
        );
        try {
          const monPage = document.getElementById("page-aimonitor");
          if (monPage && monPage.classList.contains("active")) {
            navigateTo("aimonitor");
          }
        } catch (e) {}
      }

      // Admin-only recovery from a lockdown.
      function clearSecurityLockdown() {
        if (!currentUser || currentUser.role !== "admin") {
          showToast("Only an admin account can clear a security lockdown", "err");
          return;
        }
        if (
          !confirm(
            "Clear the security lockdown and re-enable the AI assistant? Only do this once you've reviewed the security events below.",
          )
        )
          return;
        webSecState.killSwitch = false;
        webSecState.lockdownReason = null;
        webSecState.lockdownAt = null;
        logSecurityEvent("LOCKDOWN_CLEARED", `Cleared by ${currentUser.name}`);
        saveWebSecState();
        addAuditLogEntry(
          "ai_security_lockdown_cleared",
          currentUser.id,
          currentUser.name,
          "Admin manually re-enabled the AI assistant after a security lockdown",
        );
        showToast("AI assistant re-enabled");
        const banner = document.getElementById("ai-offline-banner");
        if (banner)
          banner.innerHTML =
            `⚠️ Ollama is not running. Start it with: <code>ollama run ${OLLAMA_MODEL}</code>`;
        navigateTo("aimonitor");
      }

      function toggleWebSearchEnabled() {
        if (!currentUser || currentUser.role !== "admin") return;
        webSecState.enabled = !webSecState.enabled;
        saveWebSecState();
        addAuditLogEntry(
          "ai_web_search_toggled",
          currentUser.id,
          currentUser.name,
          `Web search ${webSecState.enabled ? "enabled" : "disabled"} by admin`,
        );
        navigateTo("aimonitor");
        showToast(`Web search ${webSecState.enabled ? "enabled" : "disabled"}`);
      }

      // Real (not just navigator.onLine) internet reachability check.
      async function isInternetAvailable() {
        if (!navigator.onLine) return false;
        try {
          await fetch(WEB_SEARCH_ENDPOINT + "?q=test&format=json", {
            method: "GET",
            mode: "cors",
            cache: "no-store",
            signal: AbortSignal.timeout(2500),
          });
          return true;
        } catch (e) {
          return false;
        }
      }

      function canPerformWebSearch() {
        const now = Date.now();
        webSecState.searchTimestamps = webSecState.searchTimestamps.filter(
          (t) => now - t < WEB_SEARCH_RATE_WINDOW_MS,
        );
        return webSecState.searchTimestamps.length < WEB_SEARCH_RATE_MAX;
      }

      // Validates/cleans the short query the model proposes. The model
      // NEVER supplies a URL — only a query string — so this is the only
      // model-controlled input that reaches the network.
      function sanitizeSearchQuery(q) {
        if (typeof q !== "string") return null;
        let clean = q.trim().replace(/<[^>]*>/g, "");
        if (!clean || clean.length > WEB_SEARCH_MAX_QUERY_LEN) return null;
        const malicious = detectMaliciousPattern(clean);
        if (malicious) {
          triggerSecurityLockdown(
            "Malicious pattern in AI-generated search query",
            malicious,
          );
          return null;
        }
        // Conservative allow-list: plain search-query characters only.
        if (!/^[\w\s.,?!'"%$€£&():/-]{1,150}$/i.test(clean)) return null;
        return clean;
      }

      // Asks the model (a cheap, separate, temperature-0 call) whether it
      // actually needs live web info to answer — this is what satisfies
      // "the model does not already have the information needed". Fails
      // closed: any error here just means no web search this turn.
      async function classifyNeedsWeb(userText) {
        const sys =
          'Decide whether answering the user message below requires current, real-time, or post-training-cutoff information that an offline language model would not reliably know (e.g. today\'s date, breaking news, live scores/prices, very recent releases). Respond with ONLY one line of strict JSON, nothing else: {"needs_web": true or false, "query": "short 2-8 word search query, or empty string"}';
        const prompt = sys + "\n\nUser message: " + userText + "\n\nJSON:";
        try {
          const res = await fetch(OLLAMA_URL + "/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + (window._authToken || "") },
            body: JSON.stringify({
              model: resolveOllamaModelTag(OLLAMA_MODEL) || OLLAMA_MODEL,
              prompt,
              stream: false,
              options: getModelOptions(OLLAMA_MODEL, { temperature: 0, num_predict: 80 }),
              keep_alive: "1h",
            }),
            signal: AbortSignal.timeout(45000),
          });
          if (!res.ok) return { needs_web: false, query: "" };
          const data = await res.json();
          const raw = (data.response || "").trim();
          const match = raw.match(/\{[\s\S]*\}/);
          if (!match) return { needs_web: false, query: "" };
          const parsed = JSON.parse(match[0]);
          if (typeof parsed.needs_web !== "boolean")
            return { needs_web: false, query: "" };
          return {
            needs_web: parsed.needs_web,
            query: typeof parsed.query === "string" ? parsed.query : "",
          };
        } catch (e) {
          return { needs_web: false, query: "" };
        }
      }

      // Fetches and sanitizes web results. The endpoint is fixed (no
      // model-controlled URLs/domains). Every result is HTML-stripped,
      // length-capped, and screened for malicious content before it's
      // allowed anywhere near the model's context or the user's screen.
      async function performWebSearch(query) {
        const endpoint =
          WEB_SEARCH_ENDPOINT +
          "?q=" +
          encodeURIComponent(query) +
          "&format=json&no_html=1&skip_disambig=1";
        const res = await fetch(endpoint, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error("web_search_failed");
        const data = await res.json();

        const raw = [];
        if (data.AbstractText) {
          raw.push({
            text: data.AbstractText,
            url: data.AbstractURL || "",
            source: data.AbstractSource || "",
          });
        }
        if (Array.isArray(data.RelatedTopics)) {
          for (const t of data.RelatedTopics) {
            if (raw.length >= WEB_SEARCH_MAX_RESULTS * 2) break;
            if (t && t.Text) {
              raw.push({ text: t.Text, url: t.FirstURL || "", source: "" });
            } else if (t && Array.isArray(t.Topics)) {
              for (const sub of t.Topics) {
                if (raw.length >= WEB_SEARCH_MAX_RESULTS * 2) break;
                if (sub && sub.Text)
                  raw.push({ text: sub.Text, url: sub.FirstURL || "", source: "" });
              }
            }
          }
        }

        const clean = [];
        for (const r of raw) {
          if (clean.length >= WEB_SEARCH_MAX_RESULTS) break;
          let text = String(r.text || "")
            .replace(/<[^>]*>/g, "")
            .slice(0, WEB_SEARCH_MAX_SNIPPET_LEN);
          if (!text) continue;
          const malicious = detectMaliciousPattern(text);
          if (malicious) {
            webSecState.blockedCount++;
            saveWebSecState();
            logSecurityEvent(
              "BLOCKED_RESULT",
              `${malicious} — query: "${query}"`,
            );
            triggerSecurityLockdown(
              "Malicious content detected in live web search results",
              malicious,
            );
            break; // stop processing further results entirely
          }
          let domain = "";
          try {
            domain = r.url
              ? new URL(r.url).hostname.replace(/^www\./, "")
              : r.source || "";
          } catch (e) {
            domain = r.source || "";
          }
          // Never surface anything that looks like an internal/local address,
          // even defensively (the fixed public endpoint shouldn't return
          // these, but never trust external input).
          if (/localhost|127\.0\.0\.1|192\.168\.|^10\.|file:|^\[?::1\]?$/i.test(domain))
            continue;
          clean.push({ text, domain: escapeHtml(domain) });
        }
        return clean;
      }

      // ══════════════════════════════════════════════════════
      // ─── SYSTEM MONITOR (live Ollama + browser telemetry) ─
      // ══════════════════════════════════════════════════════
      // Real data sources:
      //   - GET /api/ps    → loaded model, RAM/VRAM size, CPU/GPU split, context, expiry
      //   - navigator.connection → real network type / downlink / rtt (where supported)
      //   - fetch timing on /api/tags → real round-trip latency to the Ollama host
      //   - aiStats.messagesByUser → real distinct active user count
      // Everything below is measured, not faked. History arrays just keep the
      // last N samples so the sparkline graphs have something to draw.
      const MON_HISTORY_LEN = 30;
      let monPoller = null;

