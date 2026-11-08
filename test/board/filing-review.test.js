const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const page = fs.readFileSync('public/board.html', 'utf8');
function setup({ fail = false, ready = { CO:true, EN:true } } = {}) {
  const elements = Object.fromEntries(['name','pin','outTrain','outDate','outOn','outOffDate','outOff','outTs','homeTrain','homeDate','homeOn','homeOffDate','homeOff','homeTs','more','copy'].map(name => [name,{name,value:name,focus(){}}]));
  const nodes = Object.fromEntries(['gsend','gerr','greview','greviewbox','gconfirm','gmissing','gsetup','greviewfacts','gedit','gexport','gsum'].map(n=>[n,{textContent:'',hidden:true,checked:false,scrollIntoView(){},insertAdjacentHTML(_,s){this.html=s}}]));
  const events = {}, requests = [], saved = {};
  const form = {elements,isConnected:true,querySelector(s){return s.startsWith('input') ? {value:'CO'} : nodes[s.slice(1)]},addEventListener(n,fn){events[n]=fn}};
  const ctx = {HELD186_READY:ready,crypto:{randomUUID:()=> 'test-reference'},people:()=>({byName:{},byTurn:{}}),remember(){},claimText:(_,d)=>'Held duration: 15 hours\n'+d.reference,esc:s=>String(s),heldKey:()=>'',localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v},fetch:async (url,opts)=>{requests.push({url,opts});return {ok:!fail,status:503,json:async()=> fail ? {error:'unavailable'} : {ok:true}}},Date,Math};
  vm.createContext(ctx);
  vm.runInContext(page.slice(page.indexOf('function wireClaim('),page.indexOf('function held186(')),ctx);
  ctx.wireClaim(form,{co:'SA01',en:'S101'});
  return {nodes,elements,events,requests,saved};
}
test('filing requires review and confirmation, and editing invalidates approval',async()=>{
  const x=setup();
  assert.equal(x.nodes.gsend.disabled,true);
  await x.nodes.gsend.onclick(); assert.equal(x.requests.length,0);
  x.nodes.greview.onclick(); assert.equal(x.nodes.greviewbox.hidden,false);
  assert.match(x.nodes.greviewfacts.innerHTML,/Held duration: 15 hours/);
  assert.equal(x.nodes.gsend.disabled,true);
  x.nodes.gconfirm.checked=true;x.events.change({target:x.nodes.gconfirm});
  assert.equal(x.nodes.gsend.disabled,false);
  x.elements.outTrain.value='L50231 08';x.events.input({target:x.elements.outTrain});
  assert.equal(x.nodes.greviewbox.hidden,true); assert.equal(x.nodes.gsend.disabled,true);
});
test('successful submission records reference only after confirmation and blocks repeat click',async()=>{
  const x=setup();assert.equal(x.saved.boardHeld186Receipts,undefined);
  x.nodes.greview.onclick();x.nodes.gconfirm.checked=true;x.events.change({target:x.nodes.gconfirm});
  await x.nodes.gsend.onclick();
  const receipts=JSON.parse(x.saved.boardHeld186Receipts);
  assert.equal(receipts[0].reference,'H186-test-reference');
  assert.equal(receipts[0].name,undefined);assert.equal(receipts[0].pin,undefined);
  assert.match(x.nodes.gsum.html,/inbox delivery is not tracked/);
  await x.nodes.gsend.onclick();assert.equal(x.requests.length,1);
  assert.match(JSON.parse(x.requests[0].opts.body).text,/H186-test-reference/);
});
test('failed submission gives reason, saves no receipt and permits retry',async()=>{
  const x=setup({fail:true});x.nodes.greview.onclick();x.nodes.gconfirm.checked=true;x.events.change({target:x.nodes.gconfirm});
  await x.nodes.gsend.onclick();assert.match(x.nodes.gerr.textContent,/Not sent: unavailable/);
  assert.equal(x.saved.boardHeld186Receipts,undefined);assert.equal(x.nodes.gsend.disabled,false);
});
test('missing fields and sending configuration have separate reasons',()=>{
  const x=setup({ready:{CO:false,EN:false}});x.elements.pin.value='';x.events.input({target:x.elements.pin});
  assert.match(x.nodes.gmissing.textContent,/Still needed: PIN/);
  assert.match(x.nodes.gsetup.textContent,/not configured/);
  assert.equal(x.nodes.greview.disabled,true);assert.equal(x.nodes.gsend.disabled,true);
});
