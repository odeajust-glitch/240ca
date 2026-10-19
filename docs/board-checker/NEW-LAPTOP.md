# Moving the board checker to its own laptop

The board checker is two things: the **code** (this GitHub repo) and the
**data folder** `C:\Users\<you>\BoardChecker` (settings, browser sign-in,
snapshot history). Neither needs OneDrive. On the new laptop, keep both out of
OneDrive: clone the repo to a plain folder such as `C:\BoardChecker-code`.

## 1. Before you start (old laptop)

- Push this branch to GitHub so the new laptop can clone it (Claude can do
  this when you say so).
- Optional: copy `C:\Users\<you>\BoardChecker\history` to a USB stick if you
  want the old snapshots on the new laptop. Don't copy `.env` that way unless
  the stick stays with you; it holds your CATS password and API key.

## 2. Install the tools (new laptop)

1. **Git for Windows**: https://git-scm.com/download/win (defaults are fine).
2. **Node.js LTS**: https://nodejs.org (defaults are fine).

Open a new PowerShell window afterwards so both are on the PATH.

## 3. Get the code

```
cd C:\
git clone https://github.com/odeajust-glitch/240ca.git BoardChecker-code
cd C:\BoardChecker-code
git checkout claude/vigilant-planck-zawrj4
npm install
npm install --no-save playwright
```

The checker uses Microsoft Edge, which Windows already has. Only if you set
`BOARD_BROWSER=chromium` in `.env` do you also need
`npx playwright install chromium`.

Git will ask you to sign in to GitHub the first time.

`npm install --no-save playwright` has to be run again after any later
`npm install <package>`; npm removes Playwright otherwise.

## 4. Settings

Create the data folder and its `.env` (Notepad, plain text):

```
mkdir $HOME\BoardChecker
notepad $HOME\BoardChecker\.env
```

Put in (your own values, one per line, no spaces around `=`):

```
CATS_EMPLOYEE_NO=
CATS_PASSWORD=
ANTHROPIC_API_KEY=
BOARD_AI_MODEL=claude-haiku-5-5
```

Optional lines: `BOARD_HISTORY_DAYS=90`, `BOARD_AI_REVIEW=off`,
`BOARD_RELAY_URL=` and `BOARD_KEY=` (phone relay). See `.env.example`.

If you copied the old history, put it at `$HOME\BoardChecker\history`.

## 5. Run it

```
cd C:\BoardChecker-code
node scripts/board-auto.js --me SR03 --every 5
```

A browser opens: sign in to Microsoft (Authenticator) once; the script fills
the CATS sign-on and checks every 5 minutes. Leave the window alone.

## 6. Keep it running

- **Sleep stops it.** In Windows Settings → System → Power, set "When plugged
  in, put my device to sleep after" to **Never**, and keep the laptop plugged
  in. Closing the lid may sleep it too (Control Panel → Power Options →
  "Choose what closing the lid does").
- Windows Update can restart the laptop overnight; after a restart, run step 5
  again. (Starting it automatically at sign-in can be added later.)

## 7. Turn off the old laptop's copy

Stop the script there (Ctrl+C) so the two don't both sign in to CATS. Then
delete `C:\Users\<you>\BoardChecker\.env` on the old laptop if it won't run the
checker any more.

## 8. Start it automatically when Windows signs in (owner, 2026-10-17)

`scripts\start-board-checker.cmd` starts the board checker the same way as
step 5. To have Windows run it at sign-in:

1. Press **Windows key + R**, type `shell:startup`, press Enter. A folder opens.
2. In another window open `C:\BoardChecker-code\scripts`.
3. **Right-click** `start-board-checker.cmd` → **Show more options** →
   **Create shortcut**, then drag the new shortcut into the Startup folder.

After a restart a black window titled "Board checker" opens by itself and the
browser follows. If Microsoft asks you to sign in (Authenticator), do that;
the rest is automatic. To stop it, close that window or press Ctrl+C in it.
Windows only signs in by itself if the laptop has no password or you've set
it to; otherwise it starts as soon as you sign in.
