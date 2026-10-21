const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const G = require('../public/grievance');

const at = (date, time) => G.parseParts(date, time);

// The sample letter in the original template (div240.netlify.app), with
// the member's details as they were.
const SAMPLE = {
  name: 'Mike de Man', pin: '198259', gender: 'male',
  prevAssign: 'deadhead taxi DHT133B 30 from Sarnia Yard',
  prevOn: at('2026-04-30', '0400'), prevOff: at('2026-04-30', '1349'),
  nextAssign: 'M39931 01', nextOn: at('2026-05-01', '0500'), engineer: 'Don Wilson',
};

test('body and closing match the template letter word for word', () => {
  assert.strictEqual(G.bodyText(SAMPLE),
    'On April 30th 2026, Mike de Man – PIN 198259 worked as the Conductor on deadhead taxi DHT133B 30 from Sarnia Yard. ' +
    'His Engineer was Don Wilson. The crew went off duty at 1349. Mr. de Man booked zero hours rest at the away from home terminal. ' +
    'On May 1st 2026, Mr. de Man was called at the away from home rest facility for train M39931 01 with an on duty time of 0500. ' +
    'Mr. de Man was held at the away from home terminal for 15 hours and 11 minutes. Article 18.6 (b) reads in part,');
  assert.strictEqual(G.closingText(SAMPLE, 'th'),
    'A plan should have been made for Mr. de Man to be back on duty before the expiration of his 14th hour. ' +
    'Therefore, for the reasons stated above I am advancing his grievance to you for your review and in favor of Mr. de Man. ' +
    'We object to the actions of the employer because it violates the provisions of Article 18.');
});

test('female grievor and no engineer', () => {
  const d = { ...SAMPLE, name: 'Jane Smith', gender: 'female', engineer: null };
  const body = G.bodyText(d);
  assert.match(body, /Ms\. Smith booked zero hours/);
  assert.doesNotMatch(body, /Engineer/);
  assert.match(G.closingText(d, 'th'), /expiration of her 14th hour.*advancing her grievance/);
});

test('file number: first on-duty date, initials, letter', () => {
  assert.strictEqual(G.fileNumber(at('2026-01-05', '23:15'), 'jd', 'A'), '260105JDA');
  assert.strictEqual(G.fileNumber(null, 'JD', 'A'), '——');
  assert.strictEqual(G.fileNumber(at('2026-01-05', '0800'), ' ', 'A'), '——');
  assert.strictEqual(G.extractInitials("Mike de Man"), 'MDM');
  assert.strictEqual(G.odtFilename(at('2026-05-01', '0500')), 'odea260501.odt');
});

test('times: 0500, 5:00 and 05:00; bad times rejected', () => {
  assert.deepStrictEqual(at('2026-05-01', '0500'), at('2026-05-01', '5:00'));
  assert.deepStrictEqual(at('2026-05-01', '05:00'), { y: 2026, mo: 5, d: 1, h: 5, mi: 0 });
  assert.strictEqual(at('2026-05-01', '24:00'), null);
  assert.strictEqual(at('2026-05-01', '0560'), null);
  assert.strictEqual(at('', '0500'), null);
});

test('rest across midnight: 12h is no grievance, 15h is', () => {
  const off = at('2026-01-05', '22:30');
  const h12 = G.hoursBetween(off, at('2026-01-06', '10:30'));
  const h15 = G.hoursBetween(off, at('2026-01-06', '13:30'));
  assert.strictEqual(h12, 12);
  assert.strictEqual(h15, 15);
  assert.strictEqual(G.grievable(h12), false);
  assert.strictEqual(G.grievable(h15), true);
  assert.strictEqual(G.grievable(G.hoursBetween(off, at('2026-01-06', '12:30'))), true); // exactly 14h
  assert.strictEqual(G.durationLabel(13.99), '13h 59m');
});

test('daylight saving changes count real hours held (Eastern time)', () => {
  // Fall back 2026-11-01 02:00 EDT -> 01:00 EST: the clock shows 14h, 15h passed.
  assert.strictEqual(G.hoursBetween(at('2026-11-01', '00:30'), at('2026-11-01', '14:30')), 15);
  // Spring forward 2026-03-08: the clock shows 14h, 13h passed.
  assert.strictEqual(G.hoursBetween(at('2026-03-08', '00:00'), at('2026-03-08', '14:00')), 13);
});

test('addDays crosses month and year ends', () => {
  assert.strictEqual(G.addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(G.addDays('2026-02-28', 1), '2026-03-01');
});

test('.odt: template filled in, mimetype first and stored', async () => {
  const tpl = fs.readFileSync(path.join(__dirname, '..', 'public', 'grievance_template.odt'));
  const d = { ...SAMPLE, name: 'John <Doe> & Co', fileNum: '260430JDA' };
  const bytes = await G.buildOdt(JSZip, tpl, d, new Date(2026, 9, 21));

  // ODF: the first entry is an uncompressed "mimetype".
  const buf = Buffer.from(bytes);
  assert.strictEqual(buf.readUInt32LE(0), 0x04034b50);
  assert.strictEqual(buf.readUInt16LE(8), 0); // STORE
  assert.strictEqual(buf.toString('latin1', 30, 38), 'mimetype');

  const zip = await JSZip.loadAsync(bytes);
  assert.strictEqual(await zip.file('mimetype').async('string'), 'application/vnd.oasis.opendocument.text');
  const xml = await zip.file('content.xml').async('string');
  assert.match(xml, /Div\. 240 File # 260430JDA</);
  assert.match(xml, /October 21, 2026/);
  assert.match(xml, /John &lt;Doe&gt; &amp; Co – PIN 198259/);
  assert.match(xml, /expiration of his 14<text:span text:style-name="T71">th<\/text:span> hour/);
  assert.match(xml, /style:position="17\.78cm" style:type="right"/);
  assert.doesNotMatch(xml, /MOK|filled in by the generator|<text:date/);
  assert.ok(zip.file('Pictures/100000010000025D0000019196A9124B.png'));
});
