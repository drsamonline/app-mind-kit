# Mind Kit

Set it aside until its window, and keep the times. **It does not solve the worry, judge the night, or
diagnose anything.**

- **Demo (the app itself):** https://drsamonline.github.io/app-mind-kit/play/index.html
- **Landing page:** https://drsamonline.github.io/app-mind-kit/
- **Release:** https://github.com/drsamonline/app-mind-kit/releases/tag/app-latest
- **Plan row:** #16 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-worry-window` (lead), `app-sleep-ledger`
- **Licence:** PolyForm Noncommercial 1.0.0

## Status

| | |
|---|---|
| **Built** | Worry in a window with a time, never without one; due/waiting split; early open refused; sleep efficiency from times (9h in bed, 6h asleep = 67%); per-night and averaged numbers; behaviour pattern with counts, named as association; corrupt store never emptied. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **Any advice.** No CBT-I schedule, no sleep-restriction protocol, no recommended bedtime. The spec forbids all three and the clinical decision stays with the clinician. |
| **Untested** | Whether a worry window helps anyone, and whether the pattern matches what a clinician would see. The arithmetic is asserted; the help is not something a test can prove. |

## The Worry Window spec's "done means", counted

> "a worry set aside does not reappear until its window, and then it does."

| Moment | Due | Waiting |
|---|---|---|
| 17:00 | 0 | 1 |
| 18:00 (window 18:30) | 0 | 1 |
| 19:00 | **1** | 0 |

And opening it early is refused, naming the time it opens.

## Sleep Ledger's arithmetic, counted

| In bed | Asleep | Efficiency |
|---|---|---|
| 540 min (22:00→07:00) | 360 min (−60 onset, −120 awake) | **67%** |
| 420 min (23:30→06:30, crosses midnight) | 420 min | 100% |
| 480 min, onset 480 | refused: "no sleep at all" | — |

## Two specs, one job

Worry Window *holds a worry until its time*; Sleep Ledger *computes from times, not ratings*. Both are
**put it down, and let the time do the work** — with a clock in the middle and no judgement anywhere.

## What it will not do

- **Park a worry with no time.** Refused, with the field named.
- **Solve the worry.** Closing the window puts it down.
- **Call a night good or bad.** It shows arithmetic on your own times.
- **Diagnose insomnia or set a sleep-restriction schedule.** Asserted: no `restriction` field, no recommended bedtime.
- **Start empty when the store is unreadable.** An empty list reads as "there is nothing to worry about".
- **Use a key or a network.**

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | Empty worry, empty window, nonsense time, a night with no sleep, negative minutes — each refused with the field named. |
| **No network** | Nothing changes; nothing calls out. |
| **Storage full or unavailable** | **NOT KEPT**, text stays in the box, never shown as set aside. |
| **Corrupt saved state** | Reported, raw text offered for export, never reset to empty. |

## The behaviour pattern, and why it is worded so carefully

```
In your own diary, the nights after caffeine after 4pm average 67% efficiency,
against 96% on the other nights (2 and 2 nights). That is an association in your
log, not a cause — and it is not advice.
```

Three things are deliberate: the **counts** are shown (2 and 2 nights), the word is **association**,
and the sentence ends by saying it is not advice. A pattern in four nights of a diary is not a finding.

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 66 assertions, both specs' claims
node tests/ui-tests.js        # the page in jsdom — 30 assertions (needs the dev-only jsdom)
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 26/11/2026, **all red**: a worry returning before its window (2 failures),
a worry parked with no time (1), efficiency counting time in bed as asleep (2), an unreadable store
starting empty (4), the pattern claiming a cause (1), and the app setting a sleep schedule (1).

## One test that was wrong before the code was

My "no good-night label" check failed on the **comment** that promises there is no good-night label.
The check now strips comments and scans the code. That is the third time in this project a static
check has flagged a promise instead of a feature — worth remembering when reading these suites.

## Layout

```
docs/index.html            landing page
docs/play/index.html       the app — Worry window and Sleep
docs/play/app.js           DOM wiring: park, due/waiting, nights, pattern, export, save guard
docs/play/mind-core.js     the engine — windows, efficiency, pattern, storage
docs/play/web-kit.js       vendored kit (unmodified)
docs/play/export-kit.js    vendored kit (unmodified)
tests/self-tests.js        engine suite (66)
tests/ui-tests.js          page suite (30, jsdom)
tests/page-smoke.js        shape on disk
PAGES.json                 landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **The window is a time of day, not a date.** The spec says a scheduled 15-minute slot; the slot is the time you pick, and the worry is due from that time onward.
- **A past time is allowed and opens immediately** — refusing it would punish someone for setting a window earlier in the day.
- **Efficiency is rounded to a whole percent**, because 66.67% reads as false precision in a diary.
- **The pattern needs four nights**, and only reports a behaviour logged on at least two nights with and two without. Below that it says so rather than showing a number built on one night.
- **Closing a window is a separate act from opening it**, so "I thought about it and put it down" is recorded as such.

## What is not built, and why

**Any advice.** No CBT-I schedule, no restriction protocol, no bedtime recommendation. Every one of
those is a clinical decision, the spec forbids all three, and an app that guessed would be at its most
confident exactly where it is least qualified.

**Reminders.** A notification that fails to arrive would undermine the one promise this app makes —
that the worry comes back when the window opens. Opening the app is how you find out.
