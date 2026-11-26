/* app — the Mind Kit page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * Wiring only: the window rule, the efficiency arithmetic and the pattern live in mind-core.js,
 * which the tests exercise directly.
 */
(function () {
  "use strict";

  var M = window.MindCore;
  var $ = function (id) { return document.getElementById(id); };

  var K_STATE = "mind:state";

  var els = {
    status: $("status"),
    worryText: $("worryText"), worryAt: $("worryAt"), parkBtn: $("parkBtn"), worrySays: $("worrySays"),
    dueList: $("dueList"), dueCount: $("dueCount"), dueEmpty: $("dueEmpty"),
    waitList: $("waitList"), waitCount: $("waitCount"), waitEmpty: $("waitEmpty"),
    bedTime: $("bedTime"), upTime: $("upTime"), onset: $("onset"), awake: $("awake"),
    behaviours: $("behaviours"), nightBtn: $("nightBtn"), nightSays: $("nightSays"),
    numbers: $("numbers"), nightsTable: $("nightsTable"), patternSays: $("patternSays"), patternTable: $("patternTable"),
    exportBtn: $("exportBtn"), exportNote: $("exportNote")
  };

  var state = { store: M.emptyStore(), unreadable: null };

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function setStatus(kind, msg) {
    els.status.className = "status show " + kind;
    els.status.textContent = msg;
  }
  function clearStatus() { els.status.className = "status"; els.status.textContent = ""; }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function persist() {
    try {
      window.localStorage.setItem(K_STATE, M.serialize({ savedOn: Date.now(), store: state.store }));
      return true;
    } catch (e) {
      setStatus("bad", "NOT KEPT: " + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") +
        ". The text is still in the box and it is NOT shown as set aside.");
      return false;
    }
  }

  /* ------------------------------------------------------------- worries */

  function renderWorries() {
    var v = M.worryView(state.store, Date.now());

    els.dueList.textContent = "";
    els.dueCount.textContent = v.dueCount ? "\u00b7 " + v.dueCount : "";
    els.dueEmpty.hidden = v.dueCount > 0;
    v.due.forEach(function (w) {
      var li = node("li", "open", w.text);
      li.appendChild(node("span", "meta", "window " + w.windowLabel + " \u2014 open now"));
      var close = node("button", "small", "Close it");
      close.addEventListener("click", function () {
        var out = M.closeWindow(state.store, w.id, Date.now());
        if (!out.ok) { setStatus("bad", out.reason); return; }
        state.store = out.store;
        var saved = persist();
        renderWorries();
        if (saved) setStatus("ok", out.says);
      });
      li.appendChild(close);
      els.dueList.appendChild(li);
    });

    els.waitList.textContent = "";
    els.waitCount.textContent = v.waitingCount ? "\u00b7 " + v.waitingCount : "";
    els.waitEmpty.hidden = v.waitingCount > 0;
    v.waiting.forEach(function (w) {
      var li = node("li", "wait", w.text);
      li.appendChild(node("span", "meta", "set aside until " + w.windowLabel + " \u2014 it will not come back before then"));
      els.waitList.appendChild(li);
    });

    els.worrySays.textContent = v.says;
  }

  function parkIt() {
    clearStatus();
    var out = M.park(state.store, { text: els.worryText.value, windowAt: els.worryAt.value }, Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.store = out.store;
    var saved = persist();
    /* A worry that was not stored is never shown as parked: the box keeps its text. */
    if (!saved) return;
    els.worryText.value = "";
    renderWorries();
    setStatus("ok", out.says);
  }

  /* ---------------------------------------------------------------- sleep */

  function buildBehaviours() {
    els.behaviours.textContent = "";
    M.BEHAVIOURS.forEach(function (b) {
      var lab = node("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = b.id;
      cb.className = "beh";
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(" " + b.label));
      els.behaviours.appendChild(lab);
    });
  }

  function renderSleep() {
    var s = M.summary(state.store);
    els.numbers.textContent = "";
    if (!s.ok) {
      els.numbers.appendChild(node("div", null, s.reason));
      els.nightsTable.hidden = true;
    } else {
      var box = node("div");
      box.appendChild(node("div", "big", s.efficiency + "%"));
      box.appendChild(node("div", "hint", "sleep efficiency across " + s.nights + " night(s)"));
      els.numbers.appendChild(box);
      els.numbers.appendChild(node("p", null, s.says));
      els.nightsTable.hidden = false;
      var tb = els.nightsTable.querySelector("tbody");
      tb.textContent = "";
      state.store.entries.slice().reverse().forEach(function (n) {
        var tr = node("tr");
        tr.appendChild(node("td", null, n.date));
        tr.appendChild(node("td", null, n.minutesInBed + " min"));
        tr.appendChild(node("td", null, n.minutesAsleep + " min"));
        tr.appendChild(node("td", null, n.efficiency + "%"));
        tr.appendChild(node("td", null, n.behaviours.join(", ") || "\u2014"));
        tb.appendChild(tr);
      });
    }

    var p = M.behaviourPattern(state.store);
    els.patternSays.textContent = p.rows.length ? p.says : (p.reason || p.says);
    els.patternTable.hidden = p.rows.length === 0;
    if (p.rows.length) {
      var pt = els.patternTable.querySelector("tbody");
      pt.textContent = "";
      p.rows.forEach(function (r) {
        var tr = node("tr");
        tr.appendChild(node("td", null, r.label));
        tr.appendChild(node("td", null, String(r.withCount)));
        tr.appendChild(node("td", null, r.withAvg + "%"));
        tr.appendChild(node("td", null, String(r.withoutCount)));
        tr.appendChild(node("td", null, r.withoutAvg + "%"));
        pt.appendChild(tr);
      });
    }
  }

  function logNight() {
    clearStatus();
    var picked = Array.prototype.map.call(document.querySelectorAll(".beh:checked"), function (cb) { return cb.value; });
    var out = M.addNight(state.store, {
      bedTime: els.bedTime.value, upTime: els.upTime.value,
      onsetMinutes: els.onset.value, awakeMinutes: els.awake.value,
      behaviours: picked
    }, Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.store = out.store;
    var saved = persist();
    if (!saved) return;
    renderSleep();
    els.nightSays.textContent = out.says;
    setStatus("ok", out.says);
  }

  /* --------------------------------------------------------------- export */

  function doExport() {
    var out = M.exportFile("summary", { store: state.store }, { when: today() }, function (name, text, mime) {
      if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
      window.Export.save(name, text, mime);
      return true;
    });
    if (out.ok) { els.exportNote.textContent = "Wrote " + out.filename + "."; setStatus("ok", "Exported."); }
    else setStatus("bad", out.reason + ".");
  }

  /* ---------------------------------------------------------------- tabs */

  ["worry", "sleep"].forEach(function (name) {
    $("tab-" + name).addEventListener("click", function () {
      ["worry", "sleep"].forEach(function (other) {
        var on = other === name;
        $("tab-" + other).setAttribute("aria-selected", on ? "true" : "false");
        $("panel-" + other).hidden = !on;
      });
    });
  });

  /* ---------------------------------------------------------------- wire */

  els.parkBtn.addEventListener("click", parkIt);
  els.nightBtn.addEventListener("click", logNight);
  els.exportBtn.addEventListener("click", doExport);

  /* ------------------------------------------------------------ start up */

  buildBehaviours();

  var raw = null;
  try { raw = window.localStorage.getItem(K_STATE); } catch (e) { raw = null; }
  if (raw) {
    var parsed = M.parseState(raw);
    if (parsed.ok) {
      state.store = parsed.state.store;
    } else {
      /* Reported as unreadable, offered for export, and NEVER reset to empty: an empty list
         reads as "there is nothing to worry about". */
      state.unreadable = parsed;
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the unreadable store");
      keep.addEventListener("click", function () {
        var out = M.exportFile("raw", parsed, { when: today() }, function (name, text, mime) {
          if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
          window.Export.save(name, text, mime);
          return true;
        });
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.exportNote.parentNode.insertBefore(keep, els.exportNote);
    }
  }

  renderWorries();
  renderSleep();
  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
