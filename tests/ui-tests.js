#!/usr/bin/env node
/* ui-tests — the Mind Kit page in a real DOM (jsdom).
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 *   npm install --no-save jsdom && node tests/ui-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var { JSDOM } = require("jsdom");

var ROOT = path.join(__dirname, "..");
var PLAY = path.join(ROOT, "docs", "play");
var PAGE = path.join(PLAY, "index.html");

var passed = 0, failed = [];
function ok(n, c, d) { if (c) { passed++; return; } failed.push(n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }

function build(seed) {
  var dom = new JSDOM(fs.readFileSync(PAGE, "utf8"), { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; };
  w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "mind-core.js", "app.js"].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(PLAY, f), "utf8"));
  });
  return dom;
}

var dom = build(null), w = dom.window, d = w.document;
var $ = function (id) { return d.getElementById(id); };

ok("the engine loaded", !!w.MindCore);

/* ------------------------------------------------------------- the worry */

$("worryText").value = "";
$("parkBtn").click();
ok("an empty worry is refused", /nothing to set aside/.test($("status").textContent), $("status").textContent);

$("worryText").value = "the bill I have not opened";
$("worryAt").value = "";
$("parkBtn").click();
ok("a blank window is refused", /thing this app exists to prevent/.test($("status").textContent), $("status").textContent);

$("worryAt").value = "18:30";
$("parkBtn").click();
ok("the worry is parked", /Set aside until 18:30/.test($("status").textContent), $("status").textContent);
eq("the text box is cleared", $("worryText").value, "");
eq("it is in the waiting list", d.querySelectorAll("#waitList li").length, 1);
ok("it says it will not come back before then", /will not come back before then/.test($("waitList").textContent), $("waitList").textContent);
eq("nothing is open yet", d.querySelectorAll("#dueList li").length, 0);
ok("the waiting list is stored", !!w.localStorage.getItem("mind:state"));

/* a window that has already passed is open immediately */
$("worryText").value = "something already due";
$("worryAt").value = "00:01";
$("parkBtn").click();
eq("a past window opens at once", d.querySelectorAll("#dueList li").length, 1);
ok("and the open list says so", /open now/.test($("dueList").textContent), $("dueList").textContent);
d.querySelector("#dueList li button").click();
ok("closing it says it is not solved", /not solved/.test($("status").textContent), $("status").textContent);

/* --------------------------------------------------------------- the night */

$("tab-sleep").click();
eq("the sleep panel shows", $("panel-sleep").hidden, false);
eq("five behaviours are offered", d.querySelectorAll("#behaviours input").length, 5);

$("bedTime").value = "22:00"; $("upTime").value = "07:00"; $("onset").value = "60"; $("awake").value = "120";
$("nightBtn").click();
ok("the night is logged", /540 min in bed, 360 min asleep/.test($("status").textContent), $("status").textContent);
ok("the efficiency is 67%", /67%/.test($("numbers").textContent), $("numbers").textContent);
ok("the app calls it arithmetic, not a judgement", /not a judgement about the nights/.test($("numbers").textContent));

$("onset").value = "600";
$("nightBtn").click();
ok("a night with no sleep is refused", /no sleep at all/.test($("status").textContent), $("status").textContent);

/* ------------------------------------------------------------- the pattern */

var fourNights = { "mind:state": JSON.stringify({ store: { worries: [], entries: [
  { id: "n1", date: "01/11/2026", bedAt: 1, upAt: 2, bedLabel: "22:00", upLabel: "07:00", onsetMinutes: 60, awakeMinutes: 120, minutesInBed: 540, minutesAsleep: 360, efficiency: 67, behaviours: ["caffeine-late"], loggedAt: 1 },
  { id: "n2", date: "02/11/2026", bedAt: 1, upAt: 2, bedLabel: "22:00", upLabel: "07:00", onsetMinutes: 60, awakeMinutes: 120, minutesInBed: 540, minutesAsleep: 360, efficiency: 67, behaviours: ["caffeine-late"], loggedAt: 2 },
  { id: "n3", date: "03/11/2026", bedAt: 1, upAt: 2, bedLabel: "22:00", upLabel: "07:00", onsetMinutes: 10, awakeMinutes: 10, minutesInBed: 540, minutesAsleep: 520, efficiency: 96, behaviours: [], loggedAt: 3 },
  { id: "n4", date: "04/11/2026", bedAt: 1, upAt: 2, bedLabel: "22:00", upLabel: "07:00", onsetMinutes: 10, awakeMinutes: 10, minutesInBed: 540, minutesAsleep: 520, efficiency: 96, behaviours: [], loggedAt: 4 }
] } }) };
var dom2 = build(fourNights);
var d2 = dom2.window.document;
ok("the pattern is shown", /caffeine after 4pm/.test(d2.getElementById("patternSays").textContent), d2.getElementById("patternSays").textContent);
ok("it says association, not cause", /association in your log, not a cause/.test(d2.getElementById("patternSays").textContent));
eq("the pattern table is visible", d2.getElementById("patternTable").hidden, false);

/* ------------------------------------------- an unreadable store on reload */

var dom3 = build({ "mind:state": "{ broken store" });
var d3 = dom3.window.document;
ok("an unreadable store is reported", /unreadable/.test(d3.getElementById("status").textContent), d3.getElementById("status").textContent);
ok("it was NOT reset", /NOT reset/.test(d3.getElementById("status").textContent));
ok("it says why an empty list is worse", /nothing to worry about/.test(d3.getElementById("status").textContent));
ok("it offers an export of the raw text",
  Array.prototype.some.call(d3.querySelectorAll("button"), function (b) { return /Export the unreadable store/.test(b.textContent); }));
ok("the broken file is not overwritten", /broken store/.test(dom3.window.localStorage.getItem("mind:state")));

/* --------------------------------------------- a failed save says so */

var dom4 = build(null), w4 = dom4.window, d4 = dom4.window.document;
Object.defineProperty(w4, "localStorage", { configurable: true, get: function () {
  return { getItem: function () { return null; }, setItem: function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; }, removeItem: function () {}, clear: function () {} };
} });
d4.getElementById("worryText").value = "something I cannot keep";
d4.getElementById("worryAt").value = "18:30";
d4.getElementById("parkBtn").click();
ok("a failed save says NOT KEPT", /NOT KEPT:/.test(d4.getElementById("status").textContent), d4.getElementById("status").textContent);
eq("the text stays in the box", d4.getElementById("worryText").value, "something I cannot keep");
eq("it is not shown as set aside", d4.querySelectorAll("#waitList li").length, 0);
ok("and the message says it is not shown as set aside", /NOT shown as set aside/.test(d4.getElementById("status").textContent));

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
dom.window.close(); dom2.window.close(); dom3.window.close(); dom4.window.close();
