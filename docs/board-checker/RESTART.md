# Restarting the board checker for Justin

For someone helping Justin from a distance (Chrome Remote Desktop into the
"BoardChecker" laptop) when he cannot do it himself. Restart only: no code
changes, no updates, no settings.

A Claude session asked for help with this: walk the helper through the steps
below one at a time, in plain words, and ask what they see on the screen
before the next step. The helper can only do what is on this page. Anything
else (pulling new code, the Cloudflare Worker, members, `.env`, sending
alerts) waits for Justin.

## What it is

A black window titled **Board checker** on the laptop, plus a Microsoft Edge
window it drives by itself. Every 5 minutes it reads the boards and updates
the site. A watchdog inside that black window already restarts the checker
when it hangs, so most hiccups fix themselves within about 15 minutes.

- Code: `C:\BoardChecker-code`
- Data and logs: `C:\Users\odeaj\BoardChecker`

## 1. Look before touching anything

Find the black **Board checker** window (it may be minimised on the taskbar).

- The last line reads `Next check in 5 minutes…` with a time in the last 10
  minutes or so: **it is running. Do nothing.**
- It mentions a restart with a time in the last few minutes: the watchdog is
  already on it. Wait 15 minutes and look again.
- It says `Microsoft is asking you to sign in` or shows `Microsoft's number`:
  go to step 4. A restart will not help.
- It says `The board checker stopped. Press any key to close this window`, the
  last time in it is long ago, or there is no such window: go to step 2.

## 2. Stop what is left

1. If the black window is there, click it and press **Ctrl+C**. If it asks
   `Terminate batch job (Y/N)?` type **Y** and Enter. If it says `Press any
   key to close this window`, press a key.
2. If the Edge window the checker was using (it shows CATS) is still open,
   close it. Leave any other browser window alone.
3. Make sure only one black **Board checker** window is ever running. Two
   copies both sign in to CATS and fight each other.

## 3. Start it again

In File Explorer open `C:\BoardChecker-code\scripts` and double-click
**start-board-checker.cmd**.

If that does not work, open Command Prompt and type these two lines:

```bat
cd C:\BoardChecker-code
node scripts\board-watchdog.js --me SR03 --every 5
```

A black window opens, then Edge opens by itself and goes through CATS. Leave
both alone: do not click in the Edge window and do not close either one.
Within a few minutes the black window should print `Next check in 5 minutes`.
That is the checker working.

## 4. If Microsoft asks to sign in

Microsoft asks for a fresh sign-in about once a day, and it must be approved
in the Authenticator app on **Justin's phone**. Nobody else can do that part.

- If Justin can be reached at all, tell him: he approves it on his phone, and
  if the black window shows `Microsoft's number: NN`, he needs that number.
- If he cannot be reached, leave the windows open as they are. The checker
  waits and picks up by itself the moment the sign-in is approved. The site
  shows older information until then; nothing is lost.

## 5. If the laptop itself restarted (Windows Update, power cut)

Sign in to Windows if it asks. The black window may open by itself; if it has
not within a minute or two, do step 3.

## Do not

- Do not press **R** in the black window. It throws away the current
  Microsoft sign-in and asks for a new one, which only Justin's phone can
  approve.
- Do not run `git pull`, install anything, or change files.
- Do not open or share `C:\Users\odeaj\BoardChecker\.env`. It holds passwords.
- Do not put the laptop to sleep, close its lid, or unplug it.

## What to tell Justin afterwards

When you did it, what the black window said before the restart, and the last
few lines of `C:\Users\odeaj\BoardChecker\restarts.log` (open it in Notepad;
each automatic restart and its reason is listed there).
