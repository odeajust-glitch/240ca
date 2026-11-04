# Pushover for the board checker's phone messages (optional)

Owner, 2026-11-04: "Sometimes when I force a re auth I dont always get the
number … make a plan for something like push over, maybe we can test it
before paying."

## Where things stand

The checker's own messages to you (the Microsoft number, "approve it in
Authenticator", CATS pages it can't get past, stuck) go by:

1. **ntfy** (as before), now tried again for about 2 minutes if the
   laptop's connection drops;
2. **the board site's phone alerts** (the same ones your turn alerts come
   by), for the Microsoft sign-in messages only, to the phones following
   your name code (JUOD); also retried;
3. **Pushover**, once you add its two keys to `.env` (below). Off until then.

The CATS Y / N buttons stay on ntfy only (Pushover can't answer back).

## The plan: try Pushover free, then decide

Pushover's phone app has a **free 30-day trial**; after that it's a
one-time purchase per kind of device (about US$5; check pushover.net for
today's price). Messages from the checker are free (10,000 a month).

1. **Phone:** install **Pushover** from the Play Store / App Store, open it,
   make an account (this starts the trial) and let it send notifications.
2. **Your user key:** on a computer go to <https://pushover.net>, log in.
   At the top it shows **Your User Key** (letters and numbers). Keep the page open.
3. **The checker's key:** on the same page, scroll to **Your Applications**
   → **Create an Application/API Token**. Name: `Board checker`, tick the
   terms, **Create Application**. It shows an **API Token/Key**.
4. **Put both in `.env` on the laptop** (never paste them in the chat):
   - Open Notepad: Start → type `notepad` → Enter.
   - File → Open → in the box type `%USERPROFILE%\BoardChecker\.env` → Open.
   - At the bottom add two lines, with your two keys after the `=`:
     ```
     BOARD_PUSHOVER_TOKEN=the API Token from step 3
     BOARD_PUSHOVER_USER=your User Key from step 2
     ```
   - File → Save. Close Notepad.
5. **Check they're there** (Command Prompt; prints `ok` or `MISSING`, not the keys):
   ```
   findstr /B /C:"BOARD_PUSHOVER_TOKEN=" "%USERPROFILE%\BoardChecker\.env" >nul && echo ok || echo MISSING
   ```
   ```
   findstr /B /C:"BOARD_PUSHOVER_USER=" "%USERPROFILE%\BoardChecker\.env" >nul && echo ok || echo MISSING
   ```
6. **Test it** (no sign-in needed):
   ```
   cd C:\BoardChecker-code
   node scripts/phone-test.js
   ```
   It sends one test message by ntfy and by Pushover and says which got
   through.
7. **Restart the checker** (Ctrl+C, then start it again). Its first lines
   say `phone alerts on (ntfy + Pushover)`.
8. **Real test:** press **R** in the checker window for a fresh sign-in;
   the number should arrive on Pushover, ntfy and as a site alert.

Use it through the trial. If Pushover is the one that always arrives, buy
it; if not, delete the two lines from `.env` and nothing else changes.

## Notes

- Pushover messages go at **high priority** (sound even in quiet hours).
  Its "emergency" priority (repeats until you tap it) could be used for the
  number if wanted.
- Code: `lib/board/owner-notify.js` (retries, ntfy, Pushover),
  `scripts/board-auto.js` `alertPhone` / `pushOwner`, `scripts/phone-test.js`.

## A fresh Microsoft sign-in from the phone

Pushover can't send anything back to the laptop, but a link can: opening
`https://ntfy.sh/<your signin topic>/publish?message=signin` in the phone's
browser sends "signin", exactly like typing it in the ntfy app.
`node scripts/phone-test.js` prints the link; in Chrome on the phone, open
it, then ⋮ → **Add to Home screen** for one-tap re-auth. The 12 h / 2 h
sign-in reminders carry a **Sign in now** button (ntfy) / link (Pushover).
