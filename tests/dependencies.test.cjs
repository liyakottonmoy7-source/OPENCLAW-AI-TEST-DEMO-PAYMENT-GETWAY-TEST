'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const lock = require('../package-lock.json');

// Check every copy, including optional production and nested build dependencies.
const patchedVersions = {
  'proxy-addr': '2.0.8',
  'source-map-js': '1.2.2',
  'brace-expansion': '2.1.7',
  '@grpc/grpc-js': '1.14.5',
  uuid: '11.1.1',
  qs: '6.16.0',
  esbuild: '0.25.0',
  '@fastify/busboy': '3.2.2',
};

for (const [name, minimum] of Object.entries(patchedVersions)) {
  test(`all locked copies of ${name} include the security fixes`, () => {
    for (const [location, pkg] of Object.entries(lock.packages)) {
      if (!location.endsWith(`/node_modules/${name}`) && location !== `node_modules/${name}`) continue;
      const actual = pkg.version.split('.').map(Number);
      const required = minimum.split('.').map(Number);
      const difference = actual.map((part, i) => part - required[i]).find(part => part !== 0) || 0;
      assert.ok(difference >= 0, `${location}: ${pkg.version} is older than ${minimum}`);
      // gRPC has separate patched release lines; stay on the tested 1.14 line.
      if (name === '@grpc/grpc-js') assert.equal(actual[0], 1);
      if (name === 'brace-expansion') assert.equal(actual[0], 2);
    }
  });
}

test('proxy trust does not accept arbitrary IPv4 clients through short IPv6 prefixes', () => {
  const proxyaddr = require('proxy-addr');
  for (const subnet of ['::ffff:10.0.0.0/8', '::/1']) {
    assert.equal(proxyaddr.compile(subnet)('203.0.113.1'), false);
  }
  const trust = proxyaddr.compile('10.0.0.0/8');
  assert.equal(trust('10.1.2.3'), true);
  assert.equal(trust('203.0.113.1'), false);
});

test('qs safely reserializes an attacker-controlled constructor.isBuffer', () => {
  const qs = require('qs');
  const parsed = qs.parse('x[constructor][isBuffer]=y', { plainObjects: true });
  assert.doesNotThrow(() => qs.stringify(parsed));
});

test('qs enforces comma array limits for bracket keys', () => {
  const qs = require('qs');
  assert.throws(() => qs.parse('a[]=1,2,3,4', {
    comma: true, arrayLimit: 3, throwOnLimitExceeded: true,
  }), RangeError);
});

test('indexed source maps reject excessively large section offsets', () => {
  const { SourceMapConsumer } = require('source-map-js');
  assert.throws(() => new SourceMapConsumer({
    version: 3,
    sections: [{
      offset: { line: 1e12, column: 0 },
      map: { version: 3, sources: ['input.js'], names: [], mappings: 'AAAA' },
    }],
  }), /Section offset line/);
});

test('the legacy Drizzle loader still transforms TypeScript with patched esbuild', async () => {
  const fromDrizzle = createRequire(require.resolve('drizzle-kit'));
  const fromLoader = createRequire(fromDrizzle.resolve('@esbuild-kit/esm-loader'));
  const { transform, transformSync } = fromLoader('@esbuild-kit/core-utils');
  const filename = path.join(__dirname, 'dependency-smoke.ts');
  const source = 'export const value: number = 42;';
  for (const result of [transformSync(source, filename), await transform(source, filename)]) {
    assert.match(result.code, /42/);
    assert.doesNotMatch(result.code, /: number/);
  }
});

test('Firebase client and Admin entry points load with the updated dependencies', () => {
  for (const name of ['firebase/firestore', 'firebase-admin/auth', 'firebase-admin/firestore', 'firebase-admin/storage']) {
    assert.doesNotThrow(() => require(name), name);
  }
});
