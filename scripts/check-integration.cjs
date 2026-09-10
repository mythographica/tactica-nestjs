#!/usr/bin/env node
/**
 * Integration check for the mnemonica stack in this demo — run after any
 * dependency bump (`npm run check:integration`). Verifies:
 *
 * 1. F12 chain: `require('@mnemonica/nestjs')` under plain CommonJS loads
 *    the adapter's build-cjs AND its internal `require('@mnemonica/dive')`
 *    lands on dive's build-cjs (dive ≥ 0.9.0 dual build) — the path that
 *    used to die with "Unexpected token 'export'" under jest ≤29.
 * 2. Singleton integrity: dive / otel / mnemonica resolve to exactly one
 *    realpath no matter which package asks (a second dive copy would split
 *    the edge ring).
 * 3. Version floor: dive ≥ 0.9.0, otel ≥ 0.1.2, nestjs ≥ 0.8.2.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

let failures = 0;

const check = (label, ok, detail) => {
	const mark = ok ? 'ok ' : 'FAIL';
	console.log(`  [${mark}] ${label}${detail ? ' — ' + detail : ''}`);
	if (!ok) {
		failures++;
	}
};

const readVersion = (pkgName) => {
	const manifest = path.join(__dirname, '..', 'node_modules', pkgName, 'package.json');
	const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8'));
	const version = parsed.version;
	return version;
};

const atLeast = (version, floor) => {
	const have = version.split('.').map(Number);
	const want = floor.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if (have[i] > want[i]) {
			return true;
		}
		if (have[i] < want[i]) {
			return false;
		}
	}
	return true;
};

// --- 1. the F12 chain ------------------------------------------------

const adapterEntry = require.resolve('@mnemonica/nestjs');
const adapterRequire = createRequire(adapterEntry);
const diveFromAdapter = adapterRequire.resolve('@mnemonica/dive');

check('adapter entry resolves to build-cjs', adapterEntry.includes('build-cjs'), adapterEntry);
check('dive (from adapter) resolves to build-cjs', diveFromAdapter.includes('build-cjs'), diveFromAdapter);

const adapter = require('@mnemonica/nestjs');
check('adapter loads under plain CJS require', typeof adapter === 'object' || typeof adapter === 'function');

const dive = require('@mnemonica/dive');
check('dive loads under plain CJS require', typeof dive.wrap === 'function');

// --- 2. singleton integrity ------------------------------------------

const projectRoot = path.join(__dirname, '..');
const singletons = ['@mnemonica/dive', '@mnemonica/otel', 'mnemonica'];
for (const pkg of singletons) {
	const fromProject = fs.realpathSync(require.resolve(pkg, { paths: [projectRoot] }));
	const fromAdapter = fs.realpathSync(adapterRequire.resolve(pkg));
	const same = fromProject === fromAdapter;
	check(`single copy of ${pkg}`, same, fromProject);
}

// --- 3. version floor --------------------------------------------------

const floors = {
	'@mnemonica/dive'   : '0.9.0',
	'@mnemonica/otel'   : '0.1.2',
	'@mnemonica/nestjs' : '0.8.2',
};
for (const [pkg, floor] of Object.entries(floors)) {
	const version = readVersion(pkg);
	check(`${pkg} ≥ ${floor}`, atLeast(version, floor), `have ${version}`);
}

// ---

if (failures > 0) {
	console.error(`\ncheck:integration FAILED — ${failures} check(s) red`);
	process.exit(1);
}
console.log('\ncheck:integration passed');
