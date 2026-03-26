import { define } from 'mnemonica';
import type {
	RootAsync,
	RootAsync_ResultFromDecorate,
	SyncBase,
	SyncBase_SubAsync,
	SyncBase_SubAsync_SubDecorate,
} from '../../.tactica/types';

// Helper for sleep simulation
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// =============================================================================
// Pattern 1: RootAsync with ResultFromDecorate sub-type (pure define chain)
// =============================================================================

define('RootAsync', async function (this: RootAsync, data: { value: number }) {
	await sleep(100);
	this.value = data.value;
	this.computed = data.value * 2;
	return this;
})
.define('ResultFromDecorate', function (this: RootAsync_ResultFromDecorate, multiplier: number) {
	this.result = this.computed * multiplier;
	this.timestamp = Date.now();
	return this;
});

// =============================================================================
// Pattern 2: Pure define chain with constructor function
// =============================================================================

// Base type with explicit baseValue property for tactica detection
define('SyncBase', function (this: SyncBase, data: { baseValue: string }) {
	this.baseValue = data.baseValue;
	this.baseValue += '123';
})
.define('SubAsync', async function (this: SyncBase_SubAsync, asyncData: { delay: number; extra: string }) {
	await sleep(100);
	this.delay = asyncData.delay;
	this.extra = asyncData.extra;
	this.processed = `${this.baseValue}-${asyncData.extra}`;
	this.baseValue += '123';
	return this;
})
.define('SubDecorate', function (this: SyncBase_SubAsync_SubDecorate, decorateValue: string) {
	this.decorateValue = decorateValue;
	this.combined = `${this.processed}:${decorateValue}`;
	return this;
});
