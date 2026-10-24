# Snapshot website on Cloudflare, with an email login

Owner, 2026-10-22: the line-up website moves off Netlify (each Netlify
publish costs credits, so it can't update every 15 minutes) to Cloudflare,
free: the board checker uploads the site's files to a Cloudflare R2 bucket,
a small Worker (`cloudflare/board-worker.js`) shows them, and Cloudflare
Access asks every visitor for an email you've allowed plus a one-time code
sent to it.

Do this once, on any computer for the Cloudflare part, then the laptop part
on the board-checker laptop. Names below (`board-site`, `board`) are what the
code expects; if you pick others, use yours in the `.env` too.

## 1. Cloudflare account
1. Go to https://dash.cloudflare.com/sign-up and make a free account.
2. Cloudflare may ask for a card when you turn on R2 or Zero Trust, even on
   the free plans. Nothing here goes past the free amounts.

## 2. Storage bucket (R2)
1. Left menu: **R2 Object Storage** (under Storage & databases). If it asks,
   turn R2 on (free plan).
2. **Create bucket** → name `board-site` → location Automatic → **Create**.
3. Back on the R2 page: **Manage API tokens** (or **API** → Manage API
   tokens) → **Create API token** (Account token is fine).
   - Permissions: **Object Read & Write**
   - Specify bucket: **Apply to specific buckets only** → `board-site`
   - **Create**.
4. The next page shows the keys **once**. Copy into Notepad for step 5:
   - **Access Key ID**
   - **Secret Access Key**
   - Your **Account ID**: the long code in the S3 address shown there,
     `https://<ACCOUNT ID>.r2.cloudflarestorage.com` (also on the R2 page).
   Keep the secret private; it can write to the bucket.

## 3. The Worker that shows the site
1. Left menu: **Workers & Pages** → **Create** → **Create Worker** (Start
   with Hello World) → name it `board` → **Deploy**.
2. **Edit code**. Delete everything in the editor. On the laptop, after
   `git pull`, open `C:\BoardChecker-code\cloudflare\board-worker.js` in
   Notepad, **Ctrl+A**, **Ctrl+C**, and paste it into the editor. **Deploy**.
3. Go back to the Worker → **Settings** → **Bindings** → **Add** → **R2
   bucket** → Variable name `SITE` (capitals) → bucket `board-site` →
   **Deploy**/**Save**.

## 4. The email login (Cloudflare Access)
1. Worker → **Settings** → **Domains & Routes**.
2. Next to **workers.dev**: **Enable Cloudflare Access**. The first time,
   Cloudflare may ask you to pick a team name and the **Free** Zero Trust
   plan (up to 50 users).
3. **Manage Cloudflare Access** → in the policy, add each email allowed in:
   yours and each rep's. Save. (Add or remove reps here any time.)
4. Next to **Preview URLs**: turn them **off** (or enable Access on them
   too), so there's no second address without the login.
5. Note the workers.dev address shown, like
   `https://board.<your-name>.workers.dev`. That's the new site.

## 5. The laptop
1. Stop the checker (Ctrl+C), then:
   ```
   cd C:\BoardChecker-code
   git pull
   notepad %USERPROFILE%\BoardChecker\.env
   ```
2. Add, with the values from step 2.4 (no spaces around `=`):
   ```
   R2_ACCOUNT_ID=
   R2_BUCKET=board-site
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   ```
   Save. With these four, the site goes to Cloudflare instead of Netlify and
   updates after every check, changed or not (`BOARD_SITE_EVERY=N` for a
   gap of N minutes). The Netlify lines can stay; they're ignored.
3. Publish once by hand to test:
   ```
   node scripts/board-site.js --deploy
   ```
   It should end `Published to Cloudflare (… files uploaded)`. If not, the
   message says which setting Cloudflare refused.
4. Start the checker as usual:
   ```
   node scripts/board-auto.js --me SR03 --every 5
   ```
   After changed checks it prints `Snapshot website updated (Cloudflare).`

## 6. Open it
Go to the workers.dev address. Cloudflare asks for your email, sends a code,
and lets you in (the sign-in lasts about a day per device). An email not on
the list never gets a code. The Article 18.6(b) names still need the
`BOARD_NAMES_KEY` passcode on top.

Old link (owner, 2026-10-22): boardtestsa.netlify.app redirects here. It
holds one `_redirects` file, uploaded by hand (Netlify → Deploys → drag the
folder), with the line `/*  https://board.sarniaboard.workers.dev/:splat  301!`.
Keep that Netlify site, and keep NETLIFY_ lines out of .env so the checker
never publishes over it.

## 7. Turn alerts on phones (owner, 2026-10-22)
In **Find a turn**, a turn's panel has **🔔 Get alerts**: that phone then
gets a notification when the turn is lined up for a train, the train is
ordered, its call moves 30 min or more, or the turn goes on duty (conductor
and engineer turns). Free, no app, no message cap (web push).

- **Android (Chrome):** tap Get alerts, allow notifications.
- **iPhone (iOS 16.4+):** Safari → Share → **Add to Home Screen**, open the
  site from that icon, then Get alerts and allow.
- Stop with **🔕 Stop alerts** on the same turn.
- **Choose what to get, per turn** (owner): under the button, tick **lined
  up**, **ordered**, **on duty**, **put on a mandatory reset** (rest or a
  hold turn until 0559, any board), **my board position changes** (with who
  went out ahead of you and on what train, or who was placed ahead), (Chain Gang SR/SD turns) **someone ahead
  goes on rest** (a turn ahead at home goes on rest or a hold turn, so it's
  skipped and you move up), **someone ahead comes off rest** (back in line
  ahead of you), and pick **call time moves …or more**
  (never, 15 min, 30 min, 1 h, 1½ h, 2 h, 3 h). Defaults: all on, 30 min.
  The two "someone ahead" alerts come only while your turn is on the Chain
  Gang or SD board at home in Sarnia (not away, not on duty).
- **A rescue train shows up where I'm waiting** (owner, 2026-10-23): a train
  whose symbol is R + another train's (M383 → RM383). On the Sarnia line-up
  (47130) it alerts every followed turn at home on a Sarnia board; on the
  Toronto line-up (41975), the crews waiting in the bunkhouse. Once per rescue.
  Needs the new Worker pasted in (it saves this choice).
  Changes save straight away. Time moves are measured from the call that
  phone was last told of, so slow drifts still add up.

Setup once, after `git pull`: paste the new `cloudflare/board-worker.js` into
the Worker again (Edit code → replace all → Deploy), then restart the checker.
The laptop makes its own push key the first time
(`BoardChecker\push-keys.json`: keep it private, don't delete it, or every
phone has to subscribe again). Subscriptions live in the bucket under
`subs/`; the Worker never shows them and the site upload never deletes them.
After a check with news, the window prints `Turn alerts: N sent …`.

## 8. "Board checker is down" alert (owner, 2026-10-22)
The Worker looks every 10 minutes at when the site was last published (the
laptop publishes after every check). No new check for 30 minutes → an ntfy
alert "Board checker is down" to the owner's phone; "Board checker is back"
when it resumes. Set up once in Cloudflare, after pasting the new Worker:
1. Worker **board** → **Settings** → **Variables and Secrets** → **Add**:
   name `NTFY_TOPIC`, value your ntfy alert topic (the same as
   `BOARD_NTFY_TOPIC` on the laptop) → **Deploy**. Optional: `DOWN_MINUTES`
   (default 30).
2. Worker **board** → **Settings** → **Trigger events** (or **Triggers**) →
   **Add** → **Cron Triggers** → every 10 minutes (`*/10 * * * *`) → Add.
The page also shows the checker's health under "Updated": last Microsoft
sign-in and today's automatic restarts.

## 9. Also on the site (owner, 2026-10-22)
- **Tracking turns (owner, 2026-10-24).** On Current and Snapshots, type a
  turn in **Find a turn**: a box opens with that turn's alert choices; **OK**
  tracks it (picked out in orange on the page, alerts on this phone),
  **Cancel** leaves it. Track as many turns as you like; tap a tracked turn's
  chip to change its alerts or **Stop tracking**.
- **Turn History tab** (between Current and Snapshots): look up any turn for
  when it goes, where it stands now, totals (trains, on duty, last on duty,
  rest, spare) and its full history. Links `#turn=SR07` open it here.
- **When does this turn go?** Find a turn → green box with the newest
  check's answer (Chain Gang position and who's ahead, or the train and call).
- **Share** a train (`#train=M38261-22`, from its story in the Order summary). The turn panel's Share button was removed (owner); a `#turn=SR07` link still opens that turn.
- **Prediction accuracy** in the Order summary: predicted vs actual crew per
  train, and % right this day / last 7 days.
- **Home-screen icon** ("240" over a rail; `scripts/make-icons.js`).
