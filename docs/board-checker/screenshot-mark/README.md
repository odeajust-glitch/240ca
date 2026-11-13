# A hidden account mark for screenshots: feasibility test, 12 Nov 2026

**13 Nov 2026: on for every signed-in account, both sites, at his word ("works great, push to the main
page").** The page (`public/board.html`, `ShotMark`, `paintShotMark`) draws the mark with the number the
Worker gives each account (`/auth/me` `mark`: 20 bits of an HMAC of the account id with a secret kept in
`accounts/shotmark.json`), and his Page Health has "Trace a screenshot", reading a picture in the browser
against every account's number. See HANDOFF. `wm.py` here is the same reader in Python (a test checks the
layout matches); its `mark_of` is only the test-site trial's plain hash, so a session tracing a members'
screenshot needs the numbers from `/health/accounts` (the owner key), not `mark_of`.
The rest of this page is the test of 12 Nov that the build rests on.

**The owner, 12 Nov 2026 (evening):** "can we make it so scren shots are blockable, or we would have a
a way to track screen shots maybe. Would it be possible to bake a hidden id number in the backround that
is not visible to people but if I gave you a picture of a screen shot or a screen shot, you would be able
to know what account it came from"

## Photos of the screen: 13 Nov 2026

The owner tried the mark: screenshots trace, photos of the screen with another phone do not (as the table below
expected). The hidden mark cannot be made to survive a camera without becoming visible. A faint **visible** code
was mocked up instead (`visible-capture.js`: board-test as the owner key, read only, drawn in that browser only):
a 4-character stand-in (the same 20-bit number fits exactly in Crockford base 32), tiled at a slant over the
screen, 15 px bold, at 4%, 6% and 9% opacity. After the photo stand-in made harsher (`treatments.photo`, 1 px more
blur, 1100 px, JPEG 70) it read by eye at all three on light pages and at 6% and 9% on dark (4% barely). Not built:
waiting on the owner. Not checked: a real camera, how it looks on his phone.

## Blocking or noticing a screenshot: no

A web page is not told when the phone takes a screenshot and cannot stop one (iPhone or Android, Safari
or Chrome, from the browser or the Home Screen icon). An Android app of our own could block screenshots
inside itself; an iPhone app can only notice after the fact. Neither stops a second phone's camera.
Not worth an app.

## Tracing a screenshot to the account: yes, tested

**The mark.** A tile of 8 × 8 cells, each cell 8 CSS px, repeated over the whole screen by one fixed,
see-through layer above everything (`position: fixed; inset: 0; pointer-events: none`, top z-index).
A marked cell is a faint grey wash: **1 level out of 255 darker on a light page** (black at alpha 1),
**about 1 lighter on a dark page** (white at alpha 2: a browser rounds a faint white wash down on a dark
page, so alpha 1 changes nothing there). Hard-edged cells (`image-rendering: pixelated`). 24 cells are a
fixed sync pattern; the other 40 carry a 20-bit number as 20 pairs (one cell of each pair marked).
The layout comes from a fixed seed (240) in `wm.py`: **it must never change once marks are out**, or
older screenshots can no longer be read.

**Reading it** (`wm.py`, Python 3 with numpy and Pillow). Knows nothing of the scale or the crop: finds
how far apart the copies of the tile are from the picture itself (small steps between neighbouring
pixels, autocorrelated), folds the whole picture onto one tile so every copy adds up, compares each pixel
only with its own background colour around it (each pixel goes to its nearest fill within 3 shades, so two
fills a few shades apart are never mixed; fixed 13 Nov, re-run with the same results; text and edges left
out), finds the sync, and matches the
40 number cells against every member's pattern. "Found" needs all four: the fold far stronger than at a
wrong spacing, the sync standing out from every other alignment, at least 80% of the number cells agreeing
with the best member, and that member 35 points clear of the next.

**How it was tested.** The main site as a member (the stand-in in HANDOFF), read only, phone sized at 3×
like an iPhone (1170 × 2532), in Chromium; the mark drawn in that browser only. Light, dark and the
Departure Board (black) styles; Current, My stats, Analytics and Order summary, at the top and scrolled.
Each screenshot was then put through Pillow stand-ins for what sharing does (`treatments.py`). 752 reads
in all, from three rounds (`capture.js` is the first round's capture).

**At the setting chosen (grey, 1 level, hard edges):**

| What happened to the screenshot | Light pages | Dark and black pages |
|---|---|---|
| As taken (PNG) | 12 of 12 | 10 of 10 |
| Emailed (JPEG 90) | 12 of 12 | 10 of 10 |
| Messenger / WhatsApp stand-in (1600 px, JPEG 75) | 12 of 12 | 10 of 10 |
| Text message stand-in (640 px wide, JPEG 60) | 12 of 12 | 6 of 10 |
| Squashed (480 px wide, JPEG 50) | 0 of 9 | 2 of 7 |
| Cropped to one box (900 × 700 px, JPEG 75) | 12 of 12 | 10 of 10 |
| Small crop (450 × 450 px, about 150 CSS px square) | 12 of 12 | 10 of 10 |
| Photo of the screen (rough stand-in: tilt, blur, noise) | 0 of 9 | 0 of 7 |

Across all 752 reads: **no unmarked screenshot was said to carry a mark (0 of 164) and no marked one was
pinned on the wrong member (0 of 588).** When it is not sure it says so; it never guessed a wrong member.

**Learned on the way.**
- 2 levels reads back more reliably (text-message size on dark pages too) but showed a faint blotchy
  texture on plain areas in 1:1 close-ups, light and dark. At 1 level the close-ups showed nothing on a
  dark page and only the faintest mottling on a light one, when looked for. **A person's eye on a real
  phone is the test still owed** (the owner's, on the test site).
- Soft cell edges (no `pixelated`) read back worse: at these strengths the smoothing rounds most of the
  wash away.
- A blue/yellow tint (in place of grey) was more visible (a yellowish blotch on light pages, a blue cast on
  dark ones) and read back worse. Dropped.

**Limits, to say plainly to the owner.** It names the account whose page was on the screen, not who
forwarded the picture. A photo of the screen with another phone is not reliable (cameras smooth faint
detail away). Screenshots taken before the mark is switched on carry nothing. A very small crop (a line
or two) or a picture squashed very small may not read. Someone technical could remove or fake it: a strong
lead, not proof.

**Not checked.** Real phones (iPhone Safari draws with WebKit, not tested; Android Chrome); real Messenger,
WhatsApp and text messages (Pillow stand-ins only); page styles other than light, dark and Departure
Board (busy backgrounds such as Fallout's scan lines leave fewer plain pixels); a computer screen.

## If he asks for it to be built

- **Test site first, as usual:** the layer on his own view of board-test (behind `PREVIEW`), and a
  "Trace a screenshot" box on Page Health: pick the picture, the page reads it (canvas, a port of
  `decode`), matches it against the Members list and names the account. He can try the whole loop on his
  phone: screenshot board-test, send it to himself, trace it.
- **For members:** the number must mean nothing on its own (never the name code: that would tell anyone
  who saw a leaked picture whose it was). The trial can work it out in the page from the account id the
  sign-in check already implies (`mark_of` here); for members it should come from a secret on the Worker
  (`/auth/me` hands each account its number; `/health/accounts` lists them for him), so nobody could work
  out another member's number and fake a screenshot. That is a Worker change, pasted into both Workers.
- **His to decide:** hidden only, or also a faint visible number (it deters, and survives a photo); and
  whether members are told that pages are marked to their account (recommended to him: it deters, and is
  fairer; how it works need not be said).
- **Tracing a picture he sends to a session:** the decoder needs the picture file itself. A picture
  pasted into a chat may reach a session only as a preview. Ask him to email it to himself and read it
  from Gmail, or use the Page Health box once built.
  `python3 -I docs/board-checker/screenshot-mark/wm.py <picture> <account ids, comma separated>`
