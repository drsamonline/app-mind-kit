/* mind-core — the engine behind Mind Kit.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: put something down, and let the time do the work. Both specs are that, with a clock in
 * the middle and no judgement anywhere:
 *
 *   worry window   a worry is written down, given a time to be thought about, and set aside until
 *                  then. It does not solve the worry, and it never parks one without a time — a
 *                  worry with no window is the thing this app exists to prevent.
 *   sleep ledger   a CBT-I diary that computes from the TIMES entered, never from a rating. Sleep
 *                  efficiency is time asleep over time in bed: nine hours in bed and six asleep
 *                  reads 67%. It never calls a night good or bad, never diagnoses, and never sets
 *                  a sleep-restriction schedule — the clinical decision stays with the clinician.
 *
 * Pure functions: no DOM, no network, no storage.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MindCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var MINUTE = 60000;
  var DAY = 86400000;

  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ddmm(ms) {
    var d = new Date(ms);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
  }
  function hhmm(ms) {
    var d = new Date(ms);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function stamp(when) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || ""));
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated";
  }

  /* "18:30" on a given day → epoch ms. Refuses anything that is not a time. */
  function parseClock(text, dayMs) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(clean(text));
    if (!m) return { ok: false, field: "time", reason: "\u201c" + clean(text) + "\u201d is not a time (use HH:MM, 24-hour)" };
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return { ok: false, field: "time", reason: "\u201c" + clean(text) + "\u201d is not a time on a clock" };
    var d = new Date(dayMs || Date.now());
    d.setHours(h, mi, 0, 0);
    return { ok: true, at: d.getTime(), label: pad(h) + ":" + pad(mi) };
  }

  /* --------------------------------------------------------- worry window */

  function emptyStore() { return { worries: [], entries: [] }; }

  /* A worry is never parked with a blank time, and never with no text. Both refusals name the
   * field, because the point of the app is that the worry HAS a window. */
  function park(store, input, now) {
    var text = clean(input && input.text);
    if (!text) return { ok: false, field: "text", reason: "a worry with no text is refused: there is nothing to set aside" };
    var when = clean(input && input.windowAt);
    if (!when) return { ok: false, field: "windowAt", reason: "a window with no time is refused. A worry with no window is the thing this app exists to prevent." };
    var t = parseClock(when, input && input.dayMs ? input.dayMs : (now || Date.now()));
    if (!t.ok) return { ok: false, field: "windowAt", reason: t.reason };
    var s = cloneStore(store);
    s.worries.push({
      id: "w" + (s.worries.length + 1),
      text: text,
      windowAt: t.at,
      windowLabel: t.label,
      parkedAt: now || Date.now(),
      opened: false
    });
    return { ok: true, store: s, worry: s.worries[s.worries.length - 1], says: "Set aside until " + t.label + ". It will not come back before then." };
  }

  /* The mechanic: a parked worry does not reappear until its window, and then it does. */
  function due(store, now) {
    var t = now || Date.now();
    var out = [];
    (store && store.worries || []).forEach(function (w) {
      if (!w.opened && w.windowAt <= t) out.push(w);
    });
    return out;
  }
  function waiting(store, now) {
    var t = now || Date.now();
    return (store && store.worries || []).filter(function (w) { return !w.opened && w.windowAt > t; });
  }
  function openWindow(store, id, now) {
    var s = cloneStore(store);
    var hit = s.worries.filter(function (w) { return w.id === id; })[0];
    if (!hit) return { ok: false, reason: "there is no worry with that id" };
    if (hit.windowAt > (now || Date.now())) {
      return { ok: false, reason: "that window has not opened yet: it opens at " + hit.windowLabel, opensAt: hit.windowAt };
    }
    hit.opened = true;
    hit.openedAt = now || Date.now();
    return { ok: true, store: s, says: "The window is open. This is the time to think about it — and then to close it again." };
  }
  function closeWindow(store, id, now) {
    var s = cloneStore(store);
    var hit = s.worries.filter(function (w) { return w.id === id; })[0];
    if (!hit) return { ok: false, reason: "there is no worry with that id" };
    hit.closedAt = now || Date.now();
    return { ok: true, store: s, says: "Closed. It is not solved \u2014 that was never the job \u2014 but it is put down." };
  }

  function worryView(store, now) {
    var d = due(store, now), w = waiting(store, now);
    return {
      due: d, waiting: w,
      dueCount: d.length, waitingCount: w.length,
      says: (d.length ? d.length + " window(s) open now. " : "") +
        (w.length ? w.length + " set aside, none of them before their time." : (d.length ? "" : "Nothing is set aside."))
    };
  }

  /* --------------------------------------------------------- sleep ledger */

  /* Times, not ratings. Time in bed comes from bedtime and getting-up time; time asleep subtracts
   * how long it took to fall asleep and how long was spent awake in the night. */
  function minutesBetween(bed, up) {
    var m = (up - bed) / MINUTE;
    if (m < 0) m += 24 * 60;
    return m;
  }

  var BEHAVIOURS = [
    { id: "caffeine-late", label: "caffeine after 4pm" },
    { id: "screens", label: "screens in bed" },
    { id: "alcohol", label: "alcohol in the evening" },
    { id: "late-meal", label: "a heavy meal late" },
    { id: "exercise", label: "exercise during the day" }
  ];

  function addNight(store, input, now) {
    var bed = parseClock(input && input.bedTime, input && input.dayMs);
    if (!bed.ok) return { ok: false, field: "bedTime", reason: "the bedtime is missing or is not a time" };
    var up = parseClock(input && input.upTime, input && input.dayMs);
    if (!up.ok) return { ok: false, field: "upTime", reason: "the getting-up time is missing or is not a time" };
    var onset = Number(input && input.onsetMinutes);
    var awake = Number(input && input.awakeMinutes);
    if (isNaN(onset) || onset < 0) return { ok: false, field: "onsetMinutes", reason: "minutes to fall asleep has to be a number, and not negative" };
    if (isNaN(awake) || awake < 0) return { ok: false, field: "awakeMinutes", reason: "minutes awake in the night has to be a number, and not negative" };

    var bedAt = bed.at;
    var upAt = up.at <= bedAt ? up.at + DAY : up.at;   /* crossing midnight */
    var tib = minutesBetween(bedAt, upAt);
    var asleep = tib - onset - awake;
    if (asleep <= 0) {
      return { ok: false, field: "onsetMinutes", reason: "that adds up to no sleep at all (" + tib + " min in bed, " + onset + " to fall asleep, " + awake + " awake). Check the times." };
    }

    var s = cloneStore(store);
    var night = {
      id: "n" + (s.entries.length + 1),
      date: ddmm(bedAt),
      bedAt: bedAt, upAt: upAt,
      bedLabel: hhmm(bedAt), upLabel: hhmm(upAt),
      onsetMinutes: onset, awakeMinutes: awake,
      minutesInBed: Math.round(tib),
      minutesAsleep: Math.round(asleep),
      efficiency: Math.round((asleep / tib) * 100),
      behaviours: (input && Array.isArray(input.behaviours) ? input.behaviours : []).filter(function (b) {
        return BEHAVIOURS.some(function (x) { return x.id === b; });
      }),
      loggedAt: now || Date.now()
    };
    s.entries.push(night);
    return { ok: true, store: s, night: night, says: night.minutesInBed + " min in bed, " + night.minutesAsleep + " min asleep \u2014 efficiency " + night.efficiency + "%." };
  }

  /* The two numbers the therapy works from, per night and averaged. No verdict, no "good night". */
  function summary(store) {
    var e = (store && store.entries) || [];
    if (!e.length) return { ok: false, reason: "no nights logged yet, so there is nothing to compute", nights: 0 };
    var tib = e.reduce(function (a, n) { return a + n.minutesInBed; }, 0);
    var tst = e.reduce(function (a, n) { return a + n.minutesAsleep; }, 0);
    return {
      ok: true,
      nights: e.length,
      minutesInBed: Math.round(tib),
      minutesAsleep: Math.round(tst),
      averageInBed: Math.round(tib / e.length),
      averageAsleep: Math.round(tst / e.length),
      efficiency: Math.round((tst / tib) * 100),
      says: e.length + " night(s): " + Math.round(tib / e.length) + " min in bed on average, " + Math.round(tst / e.length) +
        " min asleep \u2014 efficiency " + Math.round((tst / tib) * 100) + "%. This is arithmetic on the times you entered; it is not a judgement about the nights."
    };
  }

  /* Which logged behaviour preceded the lower-efficiency nights. An association in your own diary,
   * with the counts shown, and said out loud to be an association. */
  function behaviourPattern(store) {
    var e = (store && store.entries) || [];
    if (e.length < 4) {
      return { ok: false, reason: "at least four nights are needed before a pattern means anything; you have " + e.length, rows: [] };
    }
    var rows = BEHAVIOURS.map(function (b) {
      var withIt = e.filter(function (n) { return n.behaviours.indexOf(b.id) >= 0; });
      var without = e.filter(function (n) { return n.behaviours.indexOf(b.id) < 0; });
      if (!withIt.length || !without.length) return { id: b.id, label: b.label, withCount: withIt.length, withoutCount: without.length, enough: false };
      var a = withIt.reduce(function (x, n) { return x + n.efficiency; }, 0) / withIt.length;
      var c = without.reduce(function (x, n) { return x + n.efficiency; }, 0) / without.length;
      return {
        id: b.id, label: b.label,
        withCount: withIt.length, withoutCount: without.length,
        withAvg: Math.round(a), withoutAvg: Math.round(c),
        delta: Math.round(a - c),
        enough: withIt.length >= 2 && without.length >= 2
      };
    }).filter(function (r) { return r.enough; });
    rows.sort(function (x, y) { return x.delta - y.delta; });
    return {
      ok: rows.length > 0,
      rows: rows,
      reason: rows.length ? "" : "no behaviour has been logged on two nights with and two nights without yet, so no pattern is shown",
      says: rows.length
        ? "In your own diary, the nights after " + rows[0].label + " average " + rows[0].withAvg + "% efficiency, against " + rows[0].withoutAvg + "% on the other nights (" + rows[0].withCount + " and " + rows[0].withoutCount + " nights). That is an association in your log, not a cause \u2014 and it is not advice."
        : "Not enough nights with and without any one behaviour to show a pattern yet."
    };
  }

  /* --------------------------------------------------------------- storage */

  function cloneStore(s) {
    var src = s || emptyStore();
    return {
      worries: (src.worries || []).map(function (w) {
        return { id: w.id, text: w.text, windowAt: w.windowAt, windowLabel: w.windowLabel, parkedAt: w.parkedAt, opened: !!w.opened, openedAt: w.openedAt || 0, closedAt: w.closedAt || 0 };
      }),
      entries: (src.entries || []).map(function (n) {
        return {
          id: n.id, date: n.date, bedAt: n.bedAt, upAt: n.upAt, bedLabel: n.bedLabel, upLabel: n.upLabel,
          onsetMinutes: n.onsetMinutes, awakeMinutes: n.awakeMinutes,
          minutesInBed: n.minutesInBed, minutesAsleep: n.minutesAsleep, efficiency: n.efficiency,
          behaviours: (n.behaviours || []).slice(), loggedAt: n.loggedAt
        };
      })
    };
  }

  function serialize(state) {
    return JSON.stringify({ version: VERSION, savedOn: (state && state.savedOn) || 0, store: cloneStore(state && state.store) }, null, 2);
  }

  /* An unreadable store is reported as unreadable, and the raw text is offered for export before
   * anything is reset. It never silently starts empty: an empty list reads as "there is nothing to
   * worry about", which is the one thing this app must never say by accident. */
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "nothing has been set aside on this device yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) {
      return { ok: false, unreadable: true, reason: "The saved store is unreadable. It was NOT reset: an empty list would read as \u201cthere is nothing to worry about\u201d. Export the raw text to keep it.", raw: raw };
    }
    if (!data || !data.store || (!Array.isArray(data.store.worries) && !Array.isArray(data.store.entries))) {
      return { ok: false, unreadable: true, reason: "The saved file holds no store. It was not reset, and nothing was overwritten; export it to keep it.", raw: raw };
    }
    return { ok: true, state: { version: data.version || VERSION, savedOn: Number(data.savedOn) || 0, store: cloneStore(data.store) }, raw: raw };
  }

  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "text/markdown;charset=utf-8";
    if (what === "summary") {
      var st = payload.store || emptyStore();
      var lines = ["# Mind Kit \u2014 " + (meta.when || ""), ""];
      lines.push("## Worries set aside");
      lines.push("");
      if (!st.worries.length) lines.push("None.");
      st.worries.forEach(function (w) {
        lines.push("- " + w.text + "  _(window " + w.windowLabel + (w.opened ? ", opened" : "") + (w.closedAt ? ", closed" : "") + ")_");
      });
      lines.push("");
      var s = summary(st);
      lines.push("## Sleep");
      lines.push("");
      lines.push(s.ok ? "- " + s.says : "- " + s.reason);
      var pat = behaviourPattern(st);
      if (pat.rows.length) {
        lines.push("");
        lines.push("| Behaviour | Nights with | Nights without | With | Without |");
        lines.push("|---|---|---|---|---|");
        pat.rows.forEach(function (r) { lines.push("| " + r.label + " | " + r.withCount + " | " + r.withoutCount + " | " + r.withAvg + "% | " + r.withoutAvg + "% |"); });
        lines.push("");
        lines.push(pat.says);
      }
      lines.push("");
      lines.push("This app computes from the times you entered. It does not diagnose, does not set a sleep schedule, and does not stand in for a clinician.");
      name = "mind-kit-" + stamp(meta.when) + ".md";
      body = lines.join("\n");
    } else if (what === "raw") {
      name = "mind-kit-unreadable-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); mime = "text/plain;charset=utf-8";
    } else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return {
    version: VERSION,
    BEHAVIOURS: BEHAVIOURS,
    parseClock: parseClock,
    emptyStore: emptyStore,
    park: park,
    due: due,
    waiting: waiting,
    openWindow: openWindow,
    closeWindow: closeWindow,
    worryView: worryView,
    addNight: addNight,
    summary: summary,
    behaviourPattern: behaviourPattern,
    serialize: serialize,
    parseState: parseState,
    exportFile: exportFile
  };
});
