# Sending Article 18.6(b) submissions by email

Owner, 2026-11-06: members fill in the 18.6(b) form and hit **Submit**; it
goes to the conductors' or the engineers' union rep, with an optional copy
to the member. The site (a free `workers.dev` address) has no email of its
own, so it sends through a small **Google Apps Script on your Gmail**:
free, up to 100 emails a day, sent from your Gmail. The Worker allows 30
submissions a day.

You do this once. Never paste the key below into a chat.

## 1. Make up a key

Any 24 or more letters and numbers, e.g. from a password manager. You'll
paste it in two places (steps 2 and 3).

## 2. The Apps Script (on a computer, signed in to your Gmail)

1. Go to <https://script.google.com> → **New project**.
2. Delete what's there and paste this, putting your key between the quotes:

   ```js
   const KEY = 'PUT-YOUR-KEY-HERE';
   function doPost(e) {
     const d = JSON.parse(e.postData.contents);
     if (d.key !== KEY) return out({ ok: false, error: 'key' });
     const opts = { name: 'Sarnia board · 18.6(b)' };
     if (d.cc) opts.cc = d.cc;
     if (d.replyTo) opts.replyTo = d.replyTo;
     MailApp.sendEmail(d.to, d.subject, d.body, opts);
     return out({ ok: true });
   }
   function out(o) {
     return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
   }
   ```
3. Click the project name at the top and call it `Board 18.6b mail`. Save
   (the disk icon).
4. **Deploy → New deployment** → the gear beside "Select type" → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - **Deploy**. Google asks you to authorize: pick your account →
     Advanced → "Go to Board 18.6b mail (unsafe)" → **Allow** (it's your own
     script; it asks to send email as you).
5. Copy the **Web app URL** (ends in `/exec`).

## 3. The Worker's two secrets

Cloudflare → Workers & Pages → **board** → **Settings** → **Variables and
Secrets** → **Add**:

- Type **Secret**, name `MAIL_SCRIPT_URL`, value: the Web app URL → Deploy.
- Type **Secret**, name `MAIL_SCRIPT_KEY`, value: your key → Deploy.

## 4. The rep emails (Page Health)

On the site, **Page Health** → **Article 18.6(b) submissions**: the
conductors' rep email, the engineers' rep email, and (optional) the crew
names passcode so your owner key opens the names on any of your devices.
**Save.** "Email sender: set up." shows once step 3 is done.

## Check it

On the **Article 18.6(b)** tab, tap a crew, fill it in with your own email
in "Your email for a copy", **Submit to the rep**. The rep and you should
each get it within a minute. Changing the script later: Deploy → Manage
deployments → edit → New version (the URL stays the same).
