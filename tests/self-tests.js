#!/usr/bin/env node
/* self-tests — Mind Kit. No framework, no dependencies.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The Worry Window spec's "done means" is one sentence and it is counted here:
 *   "a worry set aside does not reappear until its window, and then it does."
 *
 * Sleep Ledger's numbers are counted too, because they are arithmetic: nine hours in bed and six
 * asleep reads 67%. Its must-nots are asserted: no diagnosis, no sleep-restriction schedule, no
 * "good night" or "bad night" label anywhere.
 *
 *   node tests/self-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var M = require(path.join(ROOT, "docs", "play", "mind-core.js"));

var passed = 0, failed = [], group = "";
function section(n) { group = n; }
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(group + " :: " + name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var BASE = Date.UTC(2026, 10, 26, 0, 0);   /* the sandbox clock is UTC; the engine uses local hours */
var H = 3600000;

/* ================================================ the spec's own "done means" */

section("done means — set aside does not reappear until its window, and then it does");
var parked = M.park(M.emptyStore(), { text: "the bill I have not opened", windowAt: "18:30", dayMs: BASE }, BASE + 9 * H);
eq("the worry is parked", parked.ok, true);
var store = parked.store;
eq("it has a window", store.worries[0].windowLabel, "18:30");
eq("before the window it is not due", M.due(store, BASE + 17 * H).length, 0);
eq("and it is waiting", M.waiting(store, BASE + 17 * H).length, 1);
eq("at 18:00 it is still not due", M.due(store, BASE + 18 * H).length, 0);
eq("after the window it is due", M.due(store, BASE + 19 * H).length, 1);
eq("and no longer waiting", M.waiting(store, BASE + 19 * H).length, 0);
var openedEarly = M.openWindow(store, store.worries[0].id, BASE + 18 * H);
eq("the window cannot be opened early", openedEarly.ok, false);
ok("and it says when it opens", /opens at 18:30/.test(openedEarly.reason), openedEarly.reason);
eq("it can be opened once the time comes", M.openWindow(store, store.worries[0].id, BASE + 19 * H).ok, true);

section("done means — a worry is never parked with a blank time");
var noTime = M.park(M.emptyStore(), { text: "something", windowAt: "" }, BASE);
eq("a blank window is refused", noTime.ok, false);
eq("and the field is named", noTime.field, "windowAt");
ok("and it says why this matters", /the thing this app exists to prevent/.test(noTime.reason), noTime.reason);
eq("a blank worry is refused", M.park(M.emptyStore(), { text: "", windowAt: "18:30" }, BASE).field, "text");
eq("a nonsense time is refused", M.park(M.emptyStore(), { text: "x", windowAt: "half six" }, BASE).field, "windowAt");
eq("25:00 is not a time", M.park(M.emptyStore(), { text: "x", windowAt: "25:00" }, BASE).field, "windowAt");
eq("a refused park changes nothing", M.park(M.emptyStore(), { text: "", windowAt: "" }, BASE).store, undefined);

/* ============================================================ must-nots */

section("must-not — it must not solve the worry");
var core = read("docs/play/mind-core.js");
ok("no advice, plan or solution field", !/\b(advice|solution|solveFor|plan|steps|cope)\s*[:=]/i.test(core));
ok("the close message says it is not solved", /It is not solved/.test(M.closeWindow(store, store.worries[0].id, BASE + 19 * H).says));
ok("no model, key or endpoint", !/\b(apiKey|endpoint|openai|gpt)\s*[:=]/i.test(core) && !/https?:\/\//.test(core));
ok("no network call", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(core + read("docs/play/app.js")));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));

section("must-not — an unreadable store is never silently emptied");
var bad = M.parseState("{ broken store");
eq("it is reported", bad.ok, false);
eq("it is marked unreadable", bad.unreadable, true);
ok("it says it was NOT reset", /was NOT reset/.test(bad.reason), bad.reason);
ok("and says why an empty list is worse", /nothing to worry about/.test(bad.reason), bad.reason);
eq("the raw text is kept for export", bad.raw, "{ broken store");
eq("no store saved yet is distinguished from a broken one", M.parseState("").empty, true);
eq("a broken one is not marked empty", !!bad.empty, false);

/* ==================================================== the sleep arithmetic */

section("done means (Sleep Ledger) — nine hours in bed, six asleep, 67%");
var night = M.addNight(M.emptyStore(), { bedTime: "22:00", upTime: "07:00", onsetMinutes: 60, awakeMinutes: 120, dayMs: BASE }, BASE);
eq("the night is logged", night.ok, true);
eq("nine hours in bed", night.night.minutesInBed, 540);
eq("six hours asleep", night.night.minutesAsleep, 360);
eq("which is 67% efficiency", night.night.efficiency, 67);
ok("the app states both numbers", /540 min in bed, 360 min asleep/.test(night.says), night.says);
eq("the summary agrees", M.summary(night.store).efficiency, 67);

section("the arithmetic, on the edges");
var crossMidnight = M.addNight(M.emptyStore(), { bedTime: "23:30", upTime: "06:30", onsetMinutes: 0, awakeMinutes: 0, dayMs: BASE }, BASE);
eq("a night that crosses midnight is seven hours", crossMidnight.night.minutesInBed, 420);
eq("with no wake-ups it is 100%", crossMidnight.night.efficiency, 100);
eq("no sleep at all is refused", M.addNight(M.emptyStore(), { bedTime: "22:00", upTime: "06:00", onsetMinutes: 480, awakeMinutes: 0, dayMs: BASE }, BASE).field, "onsetMinutes");
eq("a bad bedtime is refused", M.addNight(M.emptyStore(), { bedTime: "ten", upTime: "06:00", onsetMinutes: 0, awakeMinutes: 0, dayMs: BASE }, BASE).field, "bedTime");
eq("a negative onset is refused", M.addNight(M.emptyStore(), { bedTime: "22:00", upTime: "06:00", onsetMinutes: -5, awakeMinutes: 0, dayMs: BASE }, BASE).field, "onsetMinutes");
eq("an empty ledger computes nothing", M.summary(M.emptyStore()).ok, false);

section("must-not (Sleep Ledger) — no diagnosis, no schedule, no good/bad night");
ok("no diagnosis", !/diagnos\w*\s*[:(]/i.test(core));
ok("no sleep-restriction schedule", !/restrict\w*\s*[:(]/i.test(core) && !/recommend(ed)?\s*bed(time)?/i.test(core));
/* scan the CODE, not the comments: the comment that promises no "good night" must not
 * itself fail the check */
var codeOnly = core.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
ok("no good-night or bad-night label is produced",
  !/\b(good|bad|poor|great|terrible) night\b/i.test(codeOnly),
  (codeOnly.match(/\b(good|bad|poor|great|terrible) night\b/i) || [])[0]);
ok("the summary calls itself arithmetic, not a judgement", /not a judgement about the nights/.test(M.summary(night.store).says), M.summary(night.store).says);
ok("the export repeats the clinician line", /does not stand in for a clinician/.test(M.exportFile("summary", { store: night.store }, { when: "26/11/2026" }, function () { return true; }).ok ? read("docs/play/mind-core.js") : ""));

section("the pattern — an association in your own log, with the counts shown");
function fourNights(behaviourOnTwo) {
  var s = M.emptyStore();
  [[60, 120, true], [60, 120, true], [10, 10, false], [10, 10, false]].forEach(function (row) {
    s = M.addNight(s, {
      bedTime: "22:00", upTime: "07:00", onsetMinutes: row[0], awakeMinutes: row[1],
      behaviours: row[2] && behaviourOnTwo ? ["caffeine-late"] : [],
      dayMs: BASE
    }, BASE).store;
  });
  return s;
}
var pat = M.behaviourPattern(fourNights(true));
eq("a pattern is found", pat.ok, true);
eq("the behaviour is named", pat.rows[0].label, "caffeine after 4pm");
eq("two nights with it", pat.rows[0].withCount, 2);
eq("two without", pat.rows[0].withoutCount, 2);
ok("the nights with it are lower", pat.rows[0].delta < 0, pat.rows[0].delta);
ok("the sentence says it is an association, not a cause", /association in your log, not a cause/.test(pat.says), pat.says);
ok("and that it is not advice", /not advice/.test(pat.says), pat.says);
eq("three nights is not enough for a pattern", M.behaviourPattern(night.store).ok, false);
ok("and it says so with the count", /at least four nights/.test(M.behaviourPattern(night.store).reason), M.behaviourPattern(night.store).reason);

section("failure case — storage full or unavailable");
var thrown = M.exportFile("summary", { store: night.store }, { when: "26/11/2026" }, function () {
  var e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
});
eq("a failed write is reported as failed", thrown.ok, false);
ok("it says the file was not written", /not written/.test(thrown.reason), thrown.reason);
ok("it names the cause", /storage is full/.test(thrown.reason));
eq("no writer means no file", M.exportFile("summary", { store: night.store }, {}, null).ok, false);
ok("the page says the text stays in the box and is not shown as set aside", /still in the box/.test(read("docs/play/app.js")) && /NOT shown as set aside/.test(read("docs/play/app.js")));

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (s) { ok("script src resolves: " + s, fs.existsSync(path.join(ROOT, "docs", "play", s.replace(/^\.\//, "")))); });
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("self-tests: " + passed + "/" + total + " assertions passed");
