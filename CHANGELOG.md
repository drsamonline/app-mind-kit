# Changelog

All notable changes to Mind Kit are recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 26/11/2026

### Added
- **Worry window**: write a worry down, give it a time, and it stays put until then. A worry is
  **never** parked without a window — the empty field is named in the refusal, because a worry with
  no window is the thing the app exists to prevent.
- A parked worry does not reappear before its window and does reappear after it; opening a window
  early is refused and says when it opens. Closing it says it is not solved — that was never the job.
- **Sleep diary**: bedtime, getting-up time, minutes to fall asleep, minutes awake. Sleep efficiency is
  time asleep over time in bed, so nine hours in bed and six asleep reads **67%**.
- The behaviour pattern: which logged behaviour preceded the lower-efficiency nights, with the counts
  shown, and named as an association in the person's own log rather than a cause.
- Refusals: a worry with no text, a worry with no window, a nonsense time, a night that adds up to no
  sleep, a negative number of minutes.
- An unreadable store is reported and the raw text offered for export **before anything is reset** — an
  empty list would read as "there is nothing to worry about".
- A failed save says **NOT KEPT**, the text stays in the box, and the worry is never shown as set aside.
- PWA shell, CI (66 engine assertions + 30 in jsdom + page smoke), and the app-builder pipeline pinned
  to the canonical SHA for the EXE/APK/Linux release.

### Not built
- Any advice: no CBT-I schedule, no sleep-restriction protocol, no recommended bedtime. All three are
  forbidden by the spec, and the clinical decision stays with the clinician.
