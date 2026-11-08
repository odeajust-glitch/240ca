const test=require('node:test');const assert=require('node:assert/strict');const {listSubscriptions}=require('../../lib/board/r2');
const r2={accountId:'acct',bucket:'board',keyId:'KEY',secret:'SECRET'};
test('subscriber health distinguishes unreadable subscriptions from confirmed empty',async()=>{
 const xml='<ListBucketResult><Contents><Key>subs/test</Key></Contents><IsTruncated>false</IsTruncated></ListBucketResult>';
 const fetcher=async url=>new Response(new URL(url).search?xml:'bad json');
 const subs=await listSubscriptions(r2,fetcher,{diagnostics:true});assert.equal(subs.length,0);assert.equal(subs.readFailures,1);
 const empty=await listSubscriptions(r2,async()=>new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'),{diagnostics:true});assert.equal(empty.length,0);assert.equal(empty.readFailures,undefined);
 const normal=await listSubscriptions(r2,fetcher);assert.equal(normal.readFailures,undefined);
});
