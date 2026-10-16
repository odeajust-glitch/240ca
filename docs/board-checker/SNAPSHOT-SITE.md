# Line-up snapshot website: setting up the board-checker laptop

The board checker saves every check in `C:\Users\<you>\BoardChecker\history`.
With the steps below it also turns those into the line-up snapshot website and
publishes it to Netlify (site **boardtestsa**, https://boardtestsa.netlify.app)
by itself: after a check where something changed, at most every 30 minutes.
Nothing about whose turn it is goes on the site; names are masked as always.

The code is on the branch `claude/vigilant-planck-zawrj4` (it includes
everything from `claude/auto-board-checker-plan-hdk1n5`).

## 1. Stop the board checker

In its PowerShell window press **Ctrl+C**.

## 2. Get the new code

```
cd C:\BoardChecker-code
git fetch origin
git checkout claude/vigilant-planck-zawrj4
git pull
npm install
npm install --no-save playwright
```

(Use the folder you cloned into if it isn't `C:\BoardChecker-code`.)

## 3. Make a Netlify access token

1. Go to https://app.netlify.com and sign in.
2. Click your avatar (bottom left) → **User settings** → **Applications**.
3. Under **Personal access tokens**, click **New access token**. Name it
   `board checker`, pick an expiry (or none) and click **Generate token**.
4. Copy the token. Netlify only shows it once.

The token can change any of your Netlify sites, so treat it like a password:
it only goes in the `.env` file below.

## 4. Add the settings

```
notepad $HOME\BoardChecker\.env
```

Add these two lines at the bottom, with your token after the `=`:

```
NETLIFY_AUTH_TOKEN=paste-your-token-here
NETLIFY_SITE_ID=51fe13b9-72f2-4d91-8f6c-9a4afa292a58
```

Save and close Notepad. (The site ID is boardtestsa's; it's on the site's
**Site configuration** page in Netlify if you ever need it again.)

Optional lines: `BOARD_SITE_EVERY=60` publishes at most once an hour instead
of every 30 minutes; `BOARD_SITE_DAYS=14` keeps two weeks on the site instead
of 30 days.

## 5. Publish once by hand to check it works

```
node scripts/board-site.js --deploy
```

It should say `Built … snapshots over … days` and then `Published`. Open
https://boardtestsa.netlify.app: the "Sample data" tag is gone and the top
right says when it was updated. If it says `Not published`, the message says
why (usually the token or the site ID was pasted wrong).

## 6. Start the board checker again

```
node scripts/board-auto.js --me SR03 --every 5
```

After a check where something changed you'll see
`Snapshot website updated.` (at most every 30 minutes). If publishing fails it
says `Snapshot website not updated: …` and the board check carries on.

## Good to know

- Anyone with the link can see the site. Netlify can password-protect a site
  on paid plans (Site configuration → Access & security).
- Your Netlify plan may count each publish. Raise `BOARD_SITE_EVERY` if the
  usage page says you're getting close.
- To stop publishing, delete the two `NETLIFY_` lines from `.env`. No restart
  needed.
