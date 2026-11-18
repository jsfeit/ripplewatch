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

  function say(text) { if (status) status.textContent = text; }

  function ask(text) {
    say("Sending to the chat…");
    request("ui/message", { role: "user", content: { type: "text", text: text } }).then(
      function () { say("Sent. Your answer is in the chat."); },
      function () {
        try { navigator.clipboard.writeText(text); say("Couldn't post it here. Copied, so paste it into the chat."); }
        catch (e) { say("Couldn't post it here. Type: " + text); }
      }
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
    if (scored) {
      row.appendChild(el("div", "detail", "Momentum " + c.score + (c.confidence === "low" ? " · early read" : "")));
    } else if (c.activity) {
      row.appendChild(el("div", "detail", c.activity.detail));
      var ch = chips(c.activity.baseline);
      if (ch.childNodes.length) row.appendChild(ch);
      if (c.activity.nextMove) {
        var mv = el("div", "move");
        mv.appendChild(el("b", null, "Next move: "));
        mv.appendChild(document.createTextNode(c.activity.nextMove));
        row.appendChild(mv);
      }
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

    var unscored = competitors.some(function (c) { return c.score == null; });
    if (unscored) {
      app.appendChild(el("div", "note", "Momentum is a 30-day trend, so scores arrive after about a month. Until then each competitor shows what the first check found."));
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
      ya.appendChild(button("Log a deal", "Using Ripplewatch: log a deal. "));
      yrow.appendChild(ya);
      list.appendChild(yrow);
    }
    if (!competitors.length) {
      list.appendChild(el("p", "empty", "No competitors are tracked yet."));
    }
    competitors.forEach(function (c) { list.appendChild(competitorRow(c)); });
    app.appendChild(list);

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
