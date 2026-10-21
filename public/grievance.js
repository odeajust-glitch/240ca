// 14-hour rule grievance (Article 18.6(b), Agreement 4.16). Wording, file
// number and .odt edits are copied from the original generator at
// div240.netlify.app; keep them in step with grievance_template.odt.
// Shared by grievance.html and test/grievance.test.js.
(function (root) {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const TZ = 'America/Toronto';

  function extractInitials(name) {
    return name.split(/[\s''\-]+/)
      .filter((p) => p.length > 0)
      .map((p) => p[0].toUpperCase())
      .join('')
      .slice(0, 5);
  }

  // A wall-clock time in Sarnia/Toronto: { y, mo, d, h, mi }. Kept as parts
  // so the letter shows exactly what was typed, whatever the phone's zone.
  // Time accepts 0500, 5:00 or 05:00.
  function parseParts(date, time) {
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
    const tm = /^(\d{1,2}):?(\d{2})$/.exec((time || '').trim());
    if (!dm || !tm) return null;
    const h = +tm[1], mi = +tm[2];
    if (h > 23 || mi > 59) return null;
    return { y: +dm[1], mo: +dm[2], d: +dm[3], h, mi };
  }

  function addDays(date, n) {
    const t = new Date(`${date}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + n);
    return t.toISOString().slice(0, 10);
  }

  // Eastern offset at an instant, from Intl, so a rest across a daylight
  // saving change counts the real hours held.
  const fmt = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) : null;
  function offsetMs(utc) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(utc)).map((x) => [x.type, +x.value]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utc;
  }
  function epoch(t) {
    const wall = Date.UTC(t.y, t.mo - 1, t.d, t.h, t.mi);
    let utc = wall - offsetMs(wall);
    utc = wall - offsetMs(utc);
    return utc;
  }

  function hoursBetween(a, b) { return (epoch(b) - epoch(a)) / 3600000; }

  function letterDate(t) {
    const day = t.d;
    const suf = (day >= 11 && day <= 13) ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
    return `${MONTHS[t.mo - 1]} ${day}${suf} ${t.y}`;
  }

  function headerDate(d) {
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function mil(t) { return String(t.h).padStart(2, '0') + String(t.mi).padStart(2, '0'); }

  function yymmdd(t) {
    return String(t.y).slice(-2) + String(t.mo).padStart(2, '0') + String(t.d).padStart(2, '0');
  }

  function escXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Last word, plus lowercase particles before it: "Mike de Man" -> "de Man",
  // as the template letter has it (the original site wrote "Mr. Man").
  function lastName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    let i = parts.length - 1;
    while (i > 1 && /^[a-z]/.test(parts[i - 1])) i--;
    return parts.slice(i).join(' ') || fullName;
  }

  function honorific(gender) { return gender === 'female' ? 'Ms.' : 'Mr.'; }
  function pronoun(gender) { return gender === 'female' ? 'Her' : 'His'; }

  // Div. 240 File #: first shift's on-duty date (YYMMDD) + initials + letter.
  function fileNumber(prevOn, initials, letter) {
    const inits = (initials || '').trim().toUpperCase();
    if (!prevOn || !inits) return '——';
    return yymmdd(prevOn) + inits + letter;
  }

  function heldText(hrs) {
    const totalMins = Math.floor(hrs * 60 + 1e-6);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m === 0 ? `${h} hours` : `${h} hours and ${m} minutes`;
  }

  function durationLabel(hrs) {
    const totalMins = Math.floor(hrs * 60 + 1e-6);
    const h = Math.floor(totalMins / 60), m = totalMins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  // The site files a grievance at 14 h or more (button unlocks at >= 14).
  function grievable(hrs) { return hrs >= 14; }

  // Letter paragraphs as plain text, with `esc` applied to typed-in values.
  // d: { name, pin, gender, prevAssign, prevOff, nextAssign, nextOn, engineer }
  function bodyText(d, esc = (s) => s) {
    const lname = esc(lastName(d.name));
    const hon = honorific(d.gender);
    const pro = pronoun(d.gender);
    const engPart = d.engineer ? ` ${pro} Engineer was ${esc(d.engineer)}.` : '';
    const hrs = hoursBetween(d.prevOff, d.nextOn);
    return `On ${letterDate(d.prevOff)}, ${esc(d.name)} – PIN ${esc(d.pin)} worked as the ` +
      `Conductor on ${esc(d.prevAssign)}.${engPart} ` +
      `The crew went off duty at ${mil(d.prevOff)}. ${hon} ${lname} booked zero hours ` +
      `rest at the away from home terminal. On ${letterDate(d.nextOn)}, ${hon} ${lname} was called ` +
      `at the away from home rest facility for train ${esc(d.nextAssign)} ` +
      `with an on duty time of ${mil(d.nextOn)}. ${hon} ${lname} was held at the away from ` +
      `home terminal for ${heldText(hrs)}. Article 18.6 (b) reads in part,`;
  }

  // `th` is the superscript after 14; the caller decides how to mark it up.
  function closingText(d, th, esc = (s) => s) {
    const lname = esc(lastName(d.name));
    const hon = honorific(d.gender);
    const pro = pronoun(d.gender).toLowerCase();
    return `A plan should have been made for ${hon} ${lname} to be back on duty before ` +
      `the expiration of ${pro} 14${th} hour. ` +
      `Therefore, for the reasons stated above I am advancing ${pro} grievance to you for your ` +
      `review and in favor of ${hon} ${lname}. We object to the actions of the employer ` +
      `because it violates the provisions of Article 18.`;
  }

  function buildP20(d) {
    return `<text:p text:style-name="P20">${bodyText(d, escXml)}</text:p>`;
  }

  function buildP25(d) {
    return `<text:p text:style-name="P25">${closingText(d, '<text:span text:style-name="T71">th</text:span>', escXml)}</text:p>`;
  }

  function modifyXml(xml, d, today) {
    let r = xml;
    r = r.replace(
      '<style:tab-stops><style:tab-stop style:position="12.91cm"/></style:tab-stops>',
      '<style:tab-stops><style:tab-stop style:position="17.78cm" style:type="right"/></style:tab-stops>'
    );
    r = r.replace(/<text:date[^>]*>[\s\S]*?<\/text:date>/, headerDate(today));
    r = r.replace(
      '<text:span text:style-name="T11">Div. 240 File # 1</text:span>' +
      '<text:span text:style-name="T12">182</text:span>' +
      '<text:span text:style-name="T13">6</text:span>' +
      '<text:span text:style-name="T14">MOK</text:span>' +
      '<text:span text:style-name="T15">J</text:span>',
      `<text:span text:style-name="T11">Div. 240 File # ${escXml(d.fileNum)}</text:span>`
    );
    r = r.replace(/<text:p text:style-name="P20">[\s\S]*?<\/text:p>/, buildP20(d));
    r = r.replace(/<text:p text:style-name="P25">[\s\S]*?<\/text:p>/, buildP25(d));
    return r;
  }

  // Template bytes in, finished .odt bytes out. mimetype goes first and
  // uncompressed (ODF spec).
  async function buildOdt(JSZip, templateBytes, d, today) {
    const srcZip = await JSZip.loadAsync(templateBytes);
    const contentXml = await srcZip.file('content.xml').async('string');
    const modified = modifyXml(contentXml, d, today);

    const outZip = new JSZip();
    const mimeBytes = await srcZip.file('mimetype').async('uint8array');
    outZip.file('mimetype', mimeBytes, { compression: 'STORE' });

    const skip = new Set(['mimetype', 'content.xml']);
    for (const [name, entry] of Object.entries(srcZip.files)) {
      if (skip.has(name) || entry.dir) continue;
      outZip.file(name, await entry.async('uint8array'), { compression: 'DEFLATE' });
    }
    outZip.file('content.xml', modified, { compression: 'DEFLATE' });
    return outZip.generateAsync({ type: 'uint8array', mimeType: 'application/vnd.oasis.opendocument.text' });
  }

  // Conductor's last name + the return date (owner, 2026-10-21; was "odea"
  // on the original site): "Mike de Man" → deman261018.odt.
  function odtFilename(name, nextOn) {
    const last = lastName(name || '').normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    return `${last || 'grievance'}${yymmdd(nextOn)}.odt`;
  }

  const api = {
    extractInitials, parseParts, addDays, epoch, hoursBetween, letterDate, headerDate,
    mil, yymmdd, escXml, lastName, honorific, pronoun, fileNumber, heldText,
    durationLabel, grievable, bodyText, closingText, modifyXml, buildOdt, odtFilename,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Grievance = api;
})(this);
