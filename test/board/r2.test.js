const test = require('node:test');
const assert = require('node:assert/strict');
const { signRequest } = require('../../lib/board/r2');

// AWS's published Signature V4 examples for S3 (R2 signs the same way).
test('R2 request signing matches the AWS SigV4 S3 examples', () => {
  const base = { host: 'examplebucket.s3.amazonaws.com', keyId: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z') };
  const get = signRequest({ ...base, method: 'GET', path: '/test.txt', headers: { range: 'bytes=0-9' } });
  assert.match(get.headers.authorization, /SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/);
  const list = signRequest({ ...base, method: 'GET', path: '/', query: { 'max-keys': '2', prefix: 'J' } });
  assert.match(list.headers.authorization, /Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7$/);
  assert.equal(list.url, 'https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J');
});
