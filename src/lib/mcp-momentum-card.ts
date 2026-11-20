// The Momentum card: an MCP App view (https://modelcontextprotocol.io, "MCP Apps") that a supporting assistant renders
// inside the chat in place of a table. It is one self-contained HTML document with no network access: the host hands it
// the get_momentum result over postMessage and it draws the competitors, with buttons that send a follow-up question
// back into the same chat.
//
// Clients that don't support MCP Apps ignore the resource and show the tool's normal text answer, so this only adds.
// Everything drawn comes from the tool result and is set with textContent, never as HTML, because competitor names and
// signal text originate on third-party pages.
export const MOMENTUM_CARD_URI = "ui://ripplewatch/momentum-card.html";
export const MCP_APP_MIME = "text/html;profile=mcp-app";

export const MOMENTUM_CARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ripplewatch Momentum</title>
<style>
  :root {
    --bg: #ffffff; --panel: #f4f7f6; --ink: #14201e; --muted: #5a6b68; --line: #dde5e3;
    --teal: #0f5f56; --teal-soft: #e0f0ed;
    --good: #0f6b3a; --good-soft: #def3e6; --warn: #8a5a00; --warn-soft: #fbefd2; --bad: #9a2b2b; --bad-soft: #f9e0e0; --flat-soft: #e8eceb;
  }
  :root[data-theme="dark"] {
    --bg: #0f1716; --panel: #172321; --ink: #e8f0ee; --muted: #9bb0ac; --line: #28403c;
    --teal: #5fd0c2; --teal-soft: #17332f;
    --good: #6fdb9b; --good-soft: #15321f; --warn: #f0c56a; --warn-soft: #3a2f12; --bad: #f2999a; --bad-soft: #3b1c1c; --flat-soft: #223130;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0f1716; --panel: #172321; --ink: #e8f0ee; --muted: #9bb0ac; --line: #28403c;
      --teal: #5fd0c2; --teal-soft: #17332f;
      --good: #6fdb9b; --good-soft: #15321f; --warn: #f0c56a; --warn-soft: #3a2f12; --bad: #f2999a; --bad-soft: #3b1c1c; --flat-soft: #223130;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { padding: 14px; }
  h1 { font-size: 15px; margin: 0; letter-spacing: -0.01em; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .sub { color: var(--muted); font-size: 12px; }
  .note { background: var(--teal-soft); color: var(--ink); border-radius: 10px; padding: 9px 11px; font-size: 12.5px; margin-bottom: 10px; }
  .list { display: grid; gap: 8px; }
  .row { border: 1px solid var(--line); background: var(--panel); border-radius: 12px; padding: 11px 12px; display: grid; gap: 7px; }
  .row.you { background: var(--bg); border-style: dashed; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .name { font-weight: 650; font-size: 14.5px; overflow-wrap: anywhere; }
  .badge { font-size: 11.5px; font-weight: 650; padding: 2px 9px; border-radius: 999px; background: var(--flat-soft); color: var(--ink); white-space: nowrap; }
  .badge.heat { background: var(--good-soft); color: var(--good); }
  .badge.cool { background: var(--bad-soft); color: var(--bad); }
  .badge.active { background: var(--warn-soft); color: var(--warn); }
  .detail { color: var(--muted); font-size: 12.5px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 11.5px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--line); color: var(--muted); background: var(--bg); font-variant-numeric: tabular-nums; }
  .move { font-size: 12.5px; }
  .move b { color: var(--teal); font-weight: 650; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; }
  button { font: inherit; font-size: 12px; font-weight: 600; color: var(--teal); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 5px 10px; cursor: pointer; }
  button:hover { border-color: var(--teal); }
  button:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
  .score { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .cost { font-size: 12.5px; background: var(--bad-soft); color: var(--ink); border-radius: 8px; padding: 6px 9px; }
  .cost b { color: var(--bad); }
  .moved { background: var(--warn-soft); border-radius: 10px; padding: 8px 11px; margin-bottom: 10px; font-size: 12.5px; display: grid; gap: 3px; }
  .moved b { color: var(--warn); }
  .spark { display: block; }
  .str { display: grid; gap: 3px; }
  .str-h { font-size: 12.5px; font-weight: 650; }
  .str-i { font-size: 12.5px; display: flex; gap: 6px; }
  .str-i .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; background: var(--muted); }
  .str-i .dot.strength { background: var(--good); }
  .str-i .dot.weakness { background: var(--bad); }
  .opp { font-size: 12px; color: var(--muted); border-left: 3px solid var(--warn); padding-left: 9px; }
  .cov { display: flex; flex-wrap: wrap; gap: 5px; }
  .cov span { font-size: 11px; padding: 1px 7px; border-radius: 6px; border: 1px solid var(--line); color: var(--muted); }
  .cov span.off { border-style: dashed; color: var(--warn); }
  .cov-fix { font-size: 11.5px; color: var(--muted); }
  .prio { display: grid; gap: 4px; }
  .prio-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
  .prio-num { font-weight: 700; font-variant-numeric: tabular-nums; min-width: 24px; }
  .bar { flex: 1; height: 6px; border-radius: 999px; background: var(--flat-soft); overflow: hidden; }
  .bar > i { display: block; height: 100%; background: var(--teal); border-radius: 999px; }
  .prio-band { color: var(--muted); white-space: nowrap; }
  .prio-why { color: var(--muted); font-size: 12px; }
  .market { margin-top: 12px; display: grid; gap: 8px; }
  .market h2 { font-size: 13px; margin: 0; letter-spacing: -0.01em; }
  .trend { border-left: 3px solid var(--teal); padding: 2px 0 2px 10px; display: grid; gap: 3px; }
  .trend .t { font-weight: 600; font-size: 13px; }
  .trend .d { color: var(--muted); font-size: 12.5px; }
  .trend .src { color: var(--muted); font-size: 11.5px; }
  .recent { margin: 0; padding: 0; list-style: none; display: grid; gap: 3px; }
  .recent li { font-size: 12.5px; display: flex; gap: 8px; }
  .recent .when { color: var(--muted); flex: none; width: 44px; font-variant-numeric: tabular-nums; }
  .recent .what { overflow-wrap: anywhere; }
  .copybox { border: 1px dashed var(--teal); background: var(--teal-soft); border-radius: 10px; padding: 9px 11px; font-size: 12.5px; margin-top: 10px; }
  .copybox code { display: block; margin: 6px 0; padding: 6px 8px; background: var(--bg); border-radius: 6px; user-select: all; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
  .foot { margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .status { color: var(--muted); font-size: 12px; min-height: 16px; }
  .empty { color: var(--muted); padding: 18px 4px; }
</style>
</head>
<body>
<div id="app"><p class="empty">Loading Momentum…</p></div>
<script>
(function () {
  var app = document.getElementById("app");
  var nextId = 1;
  var pending = {};
  var status = null;

  function post(msg) { window.parent.postMessage(msg, "*"); }
  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      post({ jsonrpc: "2.0", id: id, method: method, params: params });
    });
  }
  function notify(method, params) { post({ jsonrpc: "2.0", method: method, params: params }); }

  function applyTheme(ctx) {
    if (ctx && (ctx.theme === "dark" || ctx.theme === "light")) document.documentElement.setAttribute("data-theme", ctx.theme);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  var canMessage = true;
  var copybox = null;

  function say(text) { if (status) status.textContent = text; }

  function showCopy(text) {
    if (!copybox) return;
    copybox.textContent = "";
    copybox.hidden = false;
    copybox.appendChild(el("div", null, "This chat doesn't let the card send messages yet. Paste this into the chat:"));
    copybox.appendChild(el("code", null, text));
    var b = el("button", null, "Copy");
    b.type = "button";
    b.addEventListener("click", function () {
      var done = function () { b.textContent = "Copied"; };
      var fail = function () { b.textContent = "Select the text above and copy it"; };
      try { navigator.clipboard.writeText(text).then(done, fail); } catch (e) { fail(); }
    });
    copybox.appendChild(b);
    resize();
  }

  function ask(text) {
    if (!canMessage) { showCopy(text); return; }
    say("Sending to the chat…");
    request("ui/message", { role: "user", content: [{ type: "text", text: text }] }).then(
      function (res) {
        // Claude may ask the user to approve the message, or place it in their message box for them to send.
        if (res && res.isError) { say(""); showCopy(text); }
        else say("Added to your chat. If it's in your message box, press send.");
      },
      function () { say(""); showCopy(text); }
    );
  }

  function button(label, text) {
    var b = el("button", null, label);
    b.type = "button";
    b.addEventListener("click", function () { ask(text); });
    return b;
  }

  function badgeFor(label) {
    var cls = "badge";
    if (label === "Heating up") cls += " heat";
    else if (label === "Check this entry") cls += " cool";
    else if (label.indexOf("Early read") === 0) cls += " active";
    else if (label === "Cooling" || label === "Gone quiet") cls += " cool";
    else if (label === "Active") cls += " active";
    return el("span", cls, label);
  }

  function money(n) { return "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }

  function chips(base) {
    var wrap = el("div", "chips");
    if (!base) return wrap;
    if (base.openRoles != null) wrap.appendChild(el("span", "chip", base.openRoles + " open roles"));
    if (base.lowestPrice != null) wrap.appendChild(el("span", "chip", "from " + money(base.lowestPrice)));
    if (base.reviewRating != null) wrap.appendChild(el("span", "chip", Number(base.reviewRating).toFixed(2) + " rating"));
    if (base.buzzMentions != null) wrap.appendChild(el("span", "chip", base.buzzMentions + " mentions"));
    return wrap;
  }

  var TYPE_LABEL = { job_posting: "hiring", pricing: "pricing", product_change: "product", news: "news", funding: "funding", review: "reviews", seo: "search" };

  function typeChips(byType) {
    var wrap = el("div", "chips");
    Object.keys(byType || {}).sort(function (a, b) { return byType[b] - byType[a]; }).forEach(function (t) {
      wrap.appendChild(el("span", "chip", byType[t] + " " + (TYPE_LABEL[t] || t)));
    });
    return wrap;
  }

  function shortDate(d) {
    var dt = new Date(d + "T00:00:00");
    return isNaN(dt) ? "" : dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function competitorRow(c) {
    var row = el("div", "row");
    var top = el("div", "top");
    top.appendChild(el("span", "name", c.name));
    var scored = c.score != null;
    if (scored) {
      top.appendChild(badgeFor(c.label || c.momentum));
    } else if (c.activity) {
      top.appendChild(badgeFor(c.activity.label));
    } else {
      top.appendChild(badgeFor(c.label || c.momentum || "No read yet"));
    }
    row.appendChild(top);
    if (c.score_by_week) {
      var pts = c.score_by_week;
      var real = pts.filter(function (v) { return v != null; });
      if (real.length >= 2) {
        var lo = Math.min.apply(null, real), hi = Math.max.apply(null, real), span = Math.max(hi - lo, 10);
        var ns = "http://www.w3.org/2000/svg";
        var svg = document.createElementNS(ns, "svg");
        svg.setAttribute("class", "spark"); svg.setAttribute("width", "96"); svg.setAttribute("height", "22"); svg.setAttribute("viewBox", "0 0 96 22");
        svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Momentum over the last four weeks");
        var path = "";
        pts.forEach(function (v, i) { if (v == null) return; var x = (i / (pts.length - 1)) * 92 + 2, y = 20 - ((v - lo) / span) * 18; path += (path ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1); });
        var line = document.createElementNS(ns, "path");
        line.setAttribute("d", path); line.setAttribute("fill", "none"); line.setAttribute("stroke", "currentColor"); line.setAttribute("stroke-width", "1.8"); line.setAttribute("stroke-linecap", "round"); line.setAttribute("stroke-linejoin", "round");
        svg.style.color = "var(--teal)";
        svg.appendChild(line);
        top.appendChild(svg);
      }
    }
    if (c.costing_you && c.costing_you.headline) {
      var cs = el("div", "cost");
      cs.appendChild(el("b", null, "Costing you: "));
      cs.appendChild(document.createTextNode(c.costing_you.headline));
      row.appendChild(cs);
    }
    if (c.looks_wrong) row.appendChild(el("div", "opp", "This name reads like a headline, not a company. Remove or rename it in Settings."));
    if (c.opportunity) row.appendChild(el("div", "opp", c.opportunity));
    if (c.strength_read && c.strength_read.items && c.strength_read.items.length) {
      var sr = el("div", "str");
      if (c.strength_read.headline) sr.appendChild(el("div", "str-h", c.strength_read.headline));
      c.strength_read.items.slice(0, 3).forEach(function (it) {
        var line = el("div", "str-i");
        line.appendChild(el("span", "dot " + it.direction));
        line.appendChild(el("span", null, it.text));
        sr.appendChild(line);
      });
      row.appendChild(sr);
    }
    if (c.priority && !c.looks_wrong) {
      var pr = el("div", "prio");
      var prow = el("div", "prio-row");
      prow.appendChild(el("span", "prio-num", c.priority.score));
      var bar = el("span", "bar");
      var fill = document.createElement("i");
      fill.style.width = Math.max(0, Math.min(100, c.priority.score)) + "%";
      bar.appendChild(fill);
      prow.appendChild(bar);
      prow.appendChild(el("span", "prio-band", "Watch priority · " + c.priority.band));
      pr.appendChild(prow);
      if (c.priority.reasons && c.priority.reasons.length) pr.appendChild(el("div", "prio-why", c.priority.reasons.slice(0, 3).join(" · ")));
      row.appendChild(pr);
    }
    if (scored) {
      row.appendChild(el("div", "detail", "Momentum " + c.score + (c.confidence === "low" ? " · early read" : "")));
    } else if (c.activity) {
      row.appendChild(el("div", "detail", c.activity.detail));
      var tc = typeChips(c.activity.byType);
      if (tc.childNodes.length) row.appendChild(tc);
      var ch = chips(c.activity.baseline);
      if (ch.childNodes.length) row.appendChild(ch);
      if (c.activity.recent && c.activity.recent.length) {
        var ul = el("ul", "recent");
        c.activity.recent.forEach(function (r) {
          var li = el("li");
          li.appendChild(el("span", "when", shortDate(r.date)));
          li.appendChild(el("span", "what", r.title));
          ul.appendChild(li);
        });
        row.appendChild(ul);
      }
      var due = c.activity.momentumInDays;
      row.appendChild(el("div", "score", "Momentum score: not yet" + (due != null ? (due > 0 ? ", about " + due + " days to go" : ", due any day now") : "")));
      if (c.activity.nextMove) {
        var mv = el("div", "move");
        mv.appendChild(el("b", null, "Next move: "));
        mv.appendChild(document.createTextNode(c.activity.nextMove));
        row.appendChild(mv);
      }
    }
    if (c.coverage && c.coverage.length) {
      var cov = el("div", "cov");
      c.coverage.forEach(function (src) { cov.appendChild(el("span", src.working ? "" : "off", (src.working ? "✓ " : "· ") + src.label)); });
      row.appendChild(cov);
      if (c.data_gaps) row.appendChild(el("div", "cov-fix", c.data_gaps));
    }
    var actions = el("div", "actions");
    actions.appendChild(button("What changed?", "Using Ripplewatch: what changed with " + c.name + "?"));
    actions.appendChild(button("Compare pricing", "Using Ripplewatch: compare pricing with " + c.name + "."));
    row.appendChild(actions);
    return row;
  }

  function render(data) {
    app.textContent = "";
    var competitors = (data && data.competitors) || [];
    var head = el("div", "head");
    head.appendChild(el("h1", null, "Ripplewatch · Momentum"));
    head.appendChild(el("span", "sub", competitors.length + (competitors.length === 1 ? " competitor" : " competitors")));
    app.appendChild(head);

    var moved = (data && data.what_moved_this_week) || [];
    if (moved.length) {
      var mv = el("div", "moved");
      mv.appendChild(el("b", null, "Moved this week"));
      moved.slice(0, 3).forEach(function (t) { mv.appendChild(el("div", null, t)); });
      app.appendChild(mv);
    }

    var unscoredCount = competitors.filter(function (c) { return c.score == null; }).length;
    if (unscoredCount > 0) {
      app.appendChild(el("div", "note", unscoredCount === competitors.length
        ? "Momentum is a 30-day trend, so it needs a month of history. Until then, Watch priority ranks who deserves your attention now, from what the first check found and your deals."
        : "Some competitors do not have a Momentum score yet, because it needs a month of history. Those show Watch priority instead."));
    }

    var hasCost = competitors.some(function (c) { return c.costing_you; });
    var hasStrength = competitors.some(function (c) { return c.strength_read; });
    if (!hasCost || !hasStrength) {
      var missing = [];
      if (!hasCost) missing.push("what each competitor is costing you (needs some " + ((data && data.log_action && data.log_action.noun) || "deals") + " logged)");
      if (!hasStrength) missing.push("whether they look strong or under pressure (needs about two weeks of hiring, pricing and review history)");
      app.appendChild(el("div", "note", "Not showing yet: " + missing.join(", and ") + "."));
    }

    var list = el("div", "list");
    var you = data && data.your_momentum;
    if (you) {
      var yrow = el("div", "row you");
      var ytop = el("div", "top");
      ytop.appendChild(el("span", "name", "You"));
      ytop.appendChild(badgeFor(you.label || "No read yet"));
      yrow.appendChild(ytop);
      yrow.appendChild(el("div", "detail", you.score != null ? "Momentum " + you.score : "Your momentum builds from your deals and customer scores."));
      var ya = el("div", "actions");
      var la = (data && data.log_action) || { label: "Log a deal", prompt: "Using Ripplewatch: log a deal. " };
      ya.appendChild(button(la.label, la.prompt));
      yrow.appendChild(ya);
      list.appendChild(yrow);
    }
    if (!competitors.length) {
      list.appendChild(el("p", "empty", "No competitors are tracked yet."));
    }
    competitors.forEach(function (c) { list.appendChild(competitorRow(c)); });
    app.appendChild(list);

    var mc = data && data.market_context;
    if (mc && mc.trends && mc.trends.length) {
      var mk = el("div", "market");
      var mh = el("h2", null, "Market context");
      if (mc.market && mc.market.direction) mh.textContent = "Market context · " + String(mc.market.direction).replace("_", " ");
      mk.appendChild(mh);
      mc.trends.slice(0, 3).forEach(function (t) {
        var tr = el("div", "trend");
        tr.appendChild(el("div", "t", t.title));
        if (t.competitors && t.competitors.length) tr.appendChild(el("div", "d", "Touches " + t.competitors.join(", ")));
        if (t.source) tr.appendChild(el("div", "src", "Source: " + t.source));
        mk.appendChild(tr);
      });
      app.appendChild(mk);
    }

    copybox = el("div", "copybox");
    copybox.hidden = true;
    app.appendChild(copybox);
    var foot = el("div", "foot");
    status = el("span", "status", "");
    foot.appendChild(status);
    app.appendChild(foot);
    resize();
  }

  function parse(result) {
    try {
      var blocks = (result && result.content) || [];
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].type === "text") return JSON.parse(blocks[i].text);
      }
    } catch (e) {}
    return null;
  }

  var lastHeight = 0;
  function resize() {
    var h = Math.ceil(document.documentElement.scrollHeight);
    if (h !== lastHeight) { lastHeight = h; notify("ui/notifications/size-changed", { width: Math.ceil(document.documentElement.scrollWidth), height: h }); }
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.body);

  window.addEventListener("message", function (ev) {
    if (ev.source !== window.parent) return;
    var m = ev.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id != null && !m.method && pending[m.id]) {
      var p = pending[m.id]; delete pending[m.id];
      if (m.error) p.reject(m.error); else p.resolve(m.result);
      return;
    }
    if (m.method === "ui/notifications/tool-result") {
      var data = parse(m.params);
      if (data) render(data);
      else { app.textContent = ""; app.appendChild(el("p", "empty", "Ripplewatch didn't send Momentum data. Ask again in the chat.")); resize(); }
    } else if (m.method === "ui/notifications/host-context-changed") {
      applyTheme(m.params);
    } else if (m.method === "ping" && m.id != null) {
      post({ jsonrpc: "2.0", id: m.id, result: {} });
    }
  });

  request("ui/initialize", {
    protocolVersion: "2026-01-26",
    appInfo: { name: "ripplewatch-momentum-card", version: "1.0.0" },
    appCapabilities: {}
  }).then(function (res) {
    applyTheme(res && res.hostContext);
    notify("ui/notifications/initialized", {});
  }, function () {
    app.textContent = "";
    app.appendChild(el("p", "empty", "This view couldn't start. The answer is in the chat."));
  });
})();
</script>
</body>
</html>`;
