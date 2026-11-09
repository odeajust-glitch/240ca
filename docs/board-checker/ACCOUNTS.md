# Accounts: only approved people see the site

Owner, 2026-11-09: "the information is only visible if you have an account";
"I have to approve each person. Sign Up I need name, email, pin and hire
date" (the PIN is the CN employee number); "I check by eye".

Cloudflare Access was tried first on `board-test` and dropped: its free plan
stops at 50 people. The accounts are built into the Worker
(`cloudflare/board-worker.js`, "Accounts"); tests in
`test/board/accounts.test.js`.

## How it works

- **`/account`** is the sign-in / sign-up page. It always works, locked or not.
- **Sign up:** name, email, PIN (their CN employee number; the page only
  says "PIN"), hire date. The page and the emails name no place or company
  (owner: "non descript"). A 6-digit code is emailed to confirm the
  address (owner: "can we verify emails"); only then does it reach your
  list and your phone gets an ntfy alert ("New sign-up", no personal
  details). Sign-ups never confirmed are cleared after two days.
- Emails come from your Gmail address. The sender name is "Account" once
  the Gmail script's line reads `const opts = { name: d.name || 'Sarnia board · 18.6(b)' };`
  (until then it is the 18.6(b) name).
- **You approve:** open `/account` on a device that holds your owner key
  (the same key Page Health uses). The list shows each person's details;
  compare against your seniority list; **Approve** or **Decline**. Either
  way the employee number and hire date are deleted, and the person is
  emailed. **Remove access** signs an approved person out everywhere.
  **Delete from list** forgets a declined/removed person (they could then
  sign up again; a declined person can re-apply anyway).
- **After approval** the device they signed up on just opens the site. On
  any other device: `/account` → Sign in → their email → a 6-digit code by
  email (10 minutes, 5 tries). Signed in for 90 days.
- **Emails** go through the same Gmail script as 18.6(b) (EMAIL.md), at
  most 70 a day for accounts. A sign-up costs two emails (the code and the
  approval), so about 35 new people a day;
  if the allowance runs out the approval still works, the page tells you
  the email didn't go.
- **Limits:** 5 sign-ups a day per internet address, 150 a day in all.
- Account files are in R2 under `accounts/` and are never served.
- Only the owner key opens the list (not the Cloudflare Access email).

## Worker settings

| Name | Type | What |
| --- | --- | --- |
| `LOCK` | Variable | `on` = only approved accounts (and your owner-key devices) see the site. Anything else = open. |
| `SIGNUP_NOTICE` | Variable | `on` = `/auth/me` reports it, for the page's "sign up to keep access" line (the line itself is not built yet). |
| `OWNER_KEY` | Secret | Needed: opens the approval list and signs the cookies. |
| `AUTH_SECRET` | Secret, optional | Signs the cookies instead of `OWNER_KEY`. Changing whichever is used signs everyone out. |
| `MAIL_SCRIPT_URL`, `MAIL_SCRIPT_KEY` | Secrets | The Gmail script (EMAIL.md). |
| `SITE_URL` | Variable | The address put in the emails. |

Stays open when locked: `/account`, `/auth/*`, the app icon / manifest /
`board-sw.js`, `/whoami`, and the RailroadTracker relay (`/api/board*`, its
own `BOARD_KEY`). A request with `Authorization: Bearer <BOARD_KEY>` also
passes. Phones already getting alerts keep getting them.

## Rollout

1. **Test site** (`board-test`): Access off, `LOCK=on`, try sign-up,
   approval, decline, a second device, remove.
2. **Main site, unlocked:** paste the same code into `board`. Nothing
   changes for visitors; `/account` works, so people can sign up ahead of
   time. Then the notice line on the page (Test tab first).
3. **Lock:** add `LOCK=on` on `board`. To undo, delete it.

Before step 3: find out what the RailroadTracker app reads from the site
(if it reads the site's files directly it will need the `BOARD_KEY`
header), and have `board.html` send people to `/account` when a check
comes back 401 (signed out while the page is open).
