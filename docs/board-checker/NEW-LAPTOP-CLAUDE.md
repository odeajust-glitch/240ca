# For Claude on the board-checker laptop

You're helping Justin set up a laptop whose only job is running his CATS board
checker. Justin is a CN conductor (TCRC Division 240, Sarnia). Chain Gang turn
SR03. The checker signs in to CN's CATS in a browser, reads the Call Board, pool
and line-up screens every 5 minutes, and tells him when he'll be called.
Claude Haiku reviews each check that changed.

This laptop has none of the history from the old laptop's sessions. Read
these first, from the repo root:

1. `HANDOFF.md`: the running log, with decisions and open questions.
2. `docs/board-checker/NEW-LAPTOP.md`: the human setup steps. Follow them,
   with the notes below.

## Setup, in order

1. **Tools.** Check `git --version` and `node --version`. If either is missing,
   install it with winget (`winget install --id Git.Git -e`,
   `winget install --id OpenJS.NodeJS.LTS -e`). Then open a new terminal.
2. **Code.** Clone `https://github.com/odeajust-glitch/240ca.git` to
   `C:\BoardChecker-code` and check out branch
   `claude/auto-board-checker-plan-hdk1n5`. **Don't put it under OneDrive**
   (Justin's decision). The first clone opens a GitHub sign-in window for
   Justin.
3. **Packages.** In `C:\BoardChecker-code`, run `npm install`, then
   `npm install --no-save playwright`, then `npx playwright install chromium`,
   then `npm test`. All tests should pass. Any later `npm install <pkg>`
   removes Playwright; reinstall it the same way.
4. **Settings.** The data folder is `C:\Users\<user>\BoardChecker`. Create it,
   then have Justin open `notepad $HOME\BoardChecker\.env` and type
   `CATS_EMPLOYEE_NO=`, `CATS_PASSWORD=`, `ANTHROPIC_API_KEY=` and
   `BOARD_AI_MODEL=claude-haiku-5-5`, one per line, with no spaces around `=`.
   **Never ask for these values, and never print or read them.** To check the
   file, print only each name and whether it has a value (and the key's
   length). If Justin pastes a password in chat, tell him to change it. Make
   sure it's saved as plain text, not as `.env.txt` or a Word document.
5. **Old laptop off.** Before starting, confirm with Justin that the script on
   the old laptop is stopped, so the two don't both sign in to CATS.
6. **Run.** Start it in a terminal tab Justin can see:
   `cd C:\BoardChecker-code; node scripts/board-auto.js --me SR03 --every 5`.
   Justin does the Microsoft sign-in (Authenticator) in the browser it opens.
   The script fills the CATS sign-on, prints "Signed in to CATS.", and checks
   every 5 minutes. Confirm the first snapshot appears in
   `$HOME\BoardChecker\history\<date>\`.
7. **Keep it awake.** Sleep stops the checker. Walk Justin through setting
   sleep to Never when plugged in, and through what closing the lid does.
   Those are his settings to change, so don't change them for him.

## Working rules (from the old laptop's sessions)

- The tool's one job is "when do I go to work". Don't add features he didn't
  ask for.
- When he asks you to check Haiku's notes, compare each `AI CHECK` line with
  the report it judged, in the terminal or in `history\`. Say whether Haiku
  was right, then propose prompt fixes in `lib/board/review.js`.
- Only reason about times that are in a saved snapshot. If a time was never
  captured, say so; don't reconstruct it.
- Sarnia trains only: a manifest whose third digit is odd (M399, A425) is
  ordered out of Toronto and doesn't count toward Sarnia's A/B trains.
- Signing in to CATS automatically was Justin's own decision, made after the
  risk was explained (CN acceptable-use, stored password). Don't relitigate
  it, and keep the credentials in `BoardChecker\.env` only.
- Commit on the branch, push only when he says so, and update `HANDOFF.md` at
  the end of a session.
