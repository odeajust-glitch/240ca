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
- **Members tab** on the board page (owner, 2026-11-09): shown only on a
  device with the owner key. Waiting for approval at the top (Approve /
  Decline), then Approved members, each with **Access** (Member / Admin)
  and **Remove access**. An **Admin** is a member who also sees this tab
  and can approve, decline and remove members; only the owner key makes or
  removes an Admin. The same list is still on `/account`. The tab is in
  `public/board.html` (`renderMembers`), so it needs the laptop's publish
  as well as the Worker paste.
- **Profile** in ⚙ Settings on the board page (owner, 2026-11-09): the
  signed-in name, email and access, and **Sign out**. Hidden on a site
  whose Worker has no accounts.
- **After approval** the device they signed up on just opens the site. On
  any other device: `/account` → Sign in → their email → a 6-digit code by
  email (10 minutes, 5 tries). Signed in until the device goes 30 days
  without opening the site (owner, 2026-11-10); each visit renews it.
- **One device per account** (owner, 2026-11-10, so accounts aren't
  shared): signing in on another device signs the first one out, and that
  device's sign-in page says why. Each switch costs one emailed code. The
  owner-key devices are not counted, and an Admin may be signed in on
  any number of devices.
- **Emails** go through the same Gmail script as 18.6(b) (EMAIL.md), at
  most 70 a day for accounts. A sign-up costs two emails (the code and the
  approval), so about 35 new people a day;
  if the allowance runs out the approval still works, the page tells you
  the email didn't go.
- **When no code is sent the page says why** (owner, 2026-11-10, after two
  silent failures): no account with that email (and it switches to Sign
  up), still waiting for approval, already has an account, can't be used
  (removed), asked less than a minute ago, or twenty codes today already.
- `board-test` and `board` share one bucket, so they share the same
  accounts: someone approved or removed on one is the same on the other.
- The sign-up banner has a second switch in `board.html` (`SIGNUP_BANNER`,
  on since 2026-11-10); the Worker's `SIGNUP_NOTICE=on` is the one the
  owner uses.
- **Limits:** 40 sign-ups a day per internet address, 150 a day in all.
- **Follows on the Members tab** (owner, 2026-11-10): a phone that saves its
  alerts while signed in is stamped with the member's account id
  (`account` in its `subs/` file), and each approved member's row shows the
  turns followed. Phones set up before accounts show as a count of phones
  with no known member until they change their alerts while signed in.
  Followed name codes are shown as a count only (the Worker can't turn the
  hash back into a code).
- Account files are in R2 under `accounts/` and are never served.
- Only the owner key opens the list (not the Cloudflare Access email).

## Worker settings

| Name | Type | What |
| --- | --- | --- |
| `LOCK` | Variable | `on` = only approved accounts (and your owner-key devices) see the site. Anything else = open. |
| `SIGNUP_NOTICE` | Variable | `on` = `/auth/me` reports it, the board page shows its "sign up to keep access" banner to anyone not signed in. |
| `OWNER_KEY` | Secret | Needed: opens the approval list and signs the cookies. |
| `AUTH_SECRET` | Secret, optional | Signs the cookies instead of `OWNER_KEY`. Changing whichever is used signs everyone out. |
| `MAIL_SCRIPT_URL`, `MAIL_SCRIPT_KEY` | Secrets | The Gmail script (EMAIL.md). |
| `MAIL_DAY_MAX` | Variable, optional | Account emails a day; 70 if not set. Gmail stops at about 100 a day in all and 18.6(b) is allowed 30, so above 70 the two compete. Raised for the lock (2026-11-10); delete it again once things settle. |
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

Built 2026-11-10 in `board.html`: the notice banner (`SIGNUP_NOTICE=on`,
not locked, not signed in, no owner key; a waiting sign-up sees "waiting
for approval" instead) and the hop to `/account` when data comes back 401
(signed out while the page is open).

RailroadTracker is set aside (owner, 2026-11-09: "Let's forget about the
railroad app for now"): the lock does not wait on it. If the app reads the
site's files directly it will stop working once locked, until it sends the
`BOARD_KEY` header; its relay (`/api/board*`) is unaffected.
