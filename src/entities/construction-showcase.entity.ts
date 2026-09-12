import assert from 'node:assert/strict';
import { utils, call, apply, bind, define, lookup } from 'mnemonica';
import type { IDEF } from 'mnemonica';
import type { UserEntity_AdminEntity } from '../../.tactica/types';

// Side-effect imports: register the demo's types so the lookup() calls below
// resolve at runtime regardless of which module loads first.
import './user.entity';
import './async.entity';

/**
 * Construction Mechanics Showcase
 *
 * Living example for tactica's construction-mechanics recognition: fork /
 * clone / merge / call / apply / bind / chain-tip sites all record an
 * `instantiation` usage (same as plain `new` — the mechanism-kind split is
 * a deferred contract revision), so consumers counting constructions see
 * them. mnemonica 1.3+ no longer auto-injects instance methods (fork,
 * clone): each type opts in explicitly, wired below from utils — which
 * keeps every site a REAL, runnable construction. Runtime shapes are
 * asserted (instanceof / fields / parse-parent lineage) rather than typed
 * claims; scripts/check-integration.cjs executes this and polices the
 * resulting .tactica/usages.json entries.
 */

// real async marker for MechanicsAsyncRoot
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export type MechanicsRootInstance = {
	id: string;
	tag: string;
	fork: (this: object, ...forkArgs: unknown[]) => MechanicsRootInstance;
	readonly clone: MechanicsRootInstance;
};

export type MechanicsClonableInstance = {
	id: string;
	clone: () => MechanicsClonableInstance;
};

export type MechanicsAsyncRootInstance = {
	value: number;
	fork: (this: object, ...forkArgs: unknown[]) => MechanicsAsyncRootInstance | Promise<MechanicsAsyncRootInstance>;
};

export type MechanicsChainTipInstance = {
	tip: string;
};

// The chain-tip form (`new R(...).A(...)`) CALLS the nested constructor
// without `new`; tactica's generated nested ctors carry construct
// signatures only, so the root's inline instance type declares both
// signatures (the runtime proxy answers both). The handler annotation
// itself must NOT carry this member: under 0.3.8 the annotation field and
// the generated nested-ctor line emit the same name twice (TS2300) — so
// the handlers annotate data fields only, and the dual-signature view is
// applied as a separate const the chain sites construct from.
export type MechanicsChainRootInstance = {
	id: string;
	MechanicsChainTip: {
		new (data: { tip: string }): MechanicsChainTipInstance;
		(data: { tip: string }): MechanicsChainTipInstance;
	};
};

export type MechanicsAsyncChainTipInstance = {
	delay: number;
};

export type MechanicsAsyncChainRootInstance = {
	value: number;
	MechanicsAsyncChainTip: {
		new (data: { delay: number }): Promise<MechanicsAsyncChainTipInstance>;
		(data: { delay: number }): Promise<MechanicsAsyncChainTipInstance>;
	};
};

/**
 * MechanicsRoot — sync root with the opt-in fork()/clone mechanics wired
 * from utils (core types these as fork(...): this / readonly clone: this).
 */
const MechanicsRoot = define('MechanicsRoot', function (this: MechanicsRootInstance, data: { id: string; tag: string }) {
	this.id = data.id;
	this.tag = data.tag;
	this.fork = utils.fork(this);
	Object.defineProperty(this, 'clone', {
		get: () => utils.clone(this),
		configurable: true,
	});
});

/**
 * MechanicsClonable — the call-form counterpart: clone as a bound method.
 */
const MechanicsClonable = define('MechanicsClonable', function (this: MechanicsClonableInstance, data: { id: string }) {
	this.id = data.id;
	this.clone = () => utils.clone(this);
});

/**
 * MechanicsAsyncRoot — async constructor with fork wired in, for the
 * awaited-fork mechanic (fork re-runs the async constructor).
 */
const MechanicsAsyncRoot = define('MechanicsAsyncRoot', async function (this: MechanicsAsyncRootInstance, data: { value: number }) {
	await sleep(1);
	this.value = data.value;
	this.fork = utils.fork(this);
	return this;
});

/**
 * MechanicsChainRoot → MechanicsChainTip — the sync chain-tip pair. The
 * dual-signature view (call + construct on the nested ctor) is what the
 * chain-tip call form type-checks against; see the note on the instance
 * type above for why it lives on a separate const.
 */
const mechanicsChainRootBase = define('MechanicsChainRoot', function (this: { id: string }, data: { id: string }) {
	this.id = data.id;
});

const MechanicsChainTip = mechanicsChainRootBase.define('MechanicsChainTip', function (this: MechanicsChainTipInstance, data: { tip: string }) {
	this.tip = data.tip;
});

type MechanicsChainRootDual = {
	new (data: { id: string }): MechanicsChainRootInstance;
};

const MechanicsChainRoot = mechanicsChainRootBase as unknown as MechanicsChainRootDual;

/**
 * MechanicsAsyncChainRoot → MechanicsAsyncChainTip — the awaited chain-tip
 * pair (sync root, async tip: the tip call returns a promise).
 */
const mechanicsAsyncChainRootBase = define('MechanicsAsyncChainRoot', function (this: { value: number }, data: { value: number }) {
	this.value = data.value;
});

const MechanicsAsyncChainTip = mechanicsAsyncChainRootBase.define('MechanicsAsyncChainTip', async function (this: MechanicsAsyncChainTipInstance, data: { delay: number }) {
	await sleep(data.delay);
	this.delay = data.delay;
	return this;
});

type MechanicsAsyncChainRootDual = {
	new (data: { value: number }): MechanicsAsyncChainRootInstance;
};

const MechanicsAsyncChainRoot = mechanicsAsyncChainRootBase as unknown as MechanicsAsyncChainRootDual;

/**
 * Runs every construction mechanic against real instances. Each block is
 * a site tactica must record in .tactica/usages.json as an instantiation.
 */
export const runConstructionShowcase = async function (): Promise<string[]> {

	// --- fork(): re-runs the constructor — no-args and fresh args ---------
	const mechanicsRoot = new MechanicsRoot({ id: 'root-1', tag: 'original' });

	const forkedSame = mechanicsRoot.fork();
	assert.ok(forkedSame instanceof MechanicsRoot, 'fork() re-runs the root constructor');
	assert.equal(forkedSame.id, 'root-1');
	assert.equal(forkedSame.tag, 'original');
	assert.notStrictEqual(forkedSame, mechanicsRoot, 'fork yields a distinct instance');
	assert.strictEqual(utils.parent(forkedSame), mechanicsRoot, 'fork lineage: parent is the source instance');

	const forkedFresh = mechanicsRoot.fork({ id: 'root-2', tag: 'forked' });
	assert.equal(forkedFresh.id, 'root-2');
	assert.equal(forkedFresh.tag, 'forked');

	// --- clone: property form (core's `readonly clone: this`) -------------
	const clonedProperty = mechanicsRoot.clone;
	assert.ok(clonedProperty instanceof MechanicsRoot, 'clone property yields a fresh instance');
	assert.equal(clonedProperty.tag, 'original');
	assert.notStrictEqual(clonedProperty, mechanicsRoot);

	// --- clone: call form (method-bound on MechanicsClonable) -------------
	const mechanicsClonable = new MechanicsClonable({ id: 'clonable-1' });
	const clonedCall = mechanicsClonable.clone();
	assert.ok(clonedCall instanceof MechanicsClonable, 'clone() re-runs construction');
	assert.equal(clonedCall.id, 'clonable-1');
	assert.notStrictEqual(clonedCall, mechanicsClonable);

	// --- utils.merge(a, b): a's type re-run over b's context --------------
	// (demo's own UserEntity chain: merge a UserEntity over an AdminEntity)
	const UserEntity = lookup('UserEntity');
	const showcaseUser = new UserEntity({ id: 'u-show', email: 'show@case.dev', name: 'Showcase' });
	const adminContext = new showcaseUser.AdminEntity({
		id: 'u-admin',
		email: 'adm@case.dev',
		name: 'Admin',
		role: 'ops',
		permissions: ['read'],
	});
	const mergedUser = utils.merge(showcaseUser, adminContext);
	assert.ok(mergedUser instanceof UserEntity, 'merge keeps arg-0 lineage');
	assert.strictEqual(utils.parent(mergedUser), adminContext, 'merge re-parents on arg 1');
	assert.equal(mergedUser.email, 'show@case.dev');
	assert.equal(mergedUser.role, 'ops', 'arg-1 fields visible through the chain');

	// --- call / apply / bind: named imports from 'mnemonica' ---------------
	// The Ctor arg must be a subtype constructor of the entity's type. The
	// lookup()-obtained ctor is the only form carrying TypeName at runtime
	// (an instance proxy does not, and the generated ctor signatures don't
	// fit core's IDEF<T> union — bridged once here).
	const AdminEntity = lookup('UserEntity.AdminEntity') as unknown as IDEF<UserEntity_AdminEntity>;

	const calledAdmin = call(showcaseUser, AdminEntity, { id: 'c-1', email: 'c@case.dev', name: 'Called', role: 'called', permissions: [] });
	assert.equal(utils.parse(calledAdmin).name, 'AdminEntity', 'call constructs the Ctor on the entity');
	assert.equal(calledAdmin.role, 'called');
	assert.equal(calledAdmin.email, 'c@case.dev', 'the re-run constructor overwrites parent fields with its own args');
	assert.strictEqual(utils.parent(calledAdmin), showcaseUser, 'lineage: entity is the parent instance');

	const appliedAdmin = apply(showcaseUser, AdminEntity, [{ id: 'a-1', email: 'a@case.dev', name: 'Applied', role: 'applied', permissions: [] }]);
	assert.equal(utils.parse(appliedAdmin).name, 'AdminEntity', 'apply constructs the Ctor on the entity');
	assert.equal(appliedAdmin.role, 'applied');

	const boundAdminFactory = bind(showcaseUser, AdminEntity);
	const boundAdmin = boundAdminFactory({ id: 'b-1', email: 'b@case.dev', name: 'Bound', role: 'bound', permissions: [] });
	assert.equal(utils.parse(boundAdmin).name, 'AdminEntity', 'bind constructs on invocation');
	assert.equal(boundAdmin.role, 'bound');

	// --- chain tip (sync): new Root(...).Nested(...) -----------------------
	// (own showcase types: tactica's generated nested ctors are construct-only,
	// so the demo's UserEntity chain can't type-check the call form)
	const chainTipResult = new MechanicsChainRoot({ id: 'chain-1' }).MechanicsChainTip({ tip: 'sync-tip' });
	assert.ok(chainTipResult instanceof MechanicsChainTip, 'chain tip constructs the nested type');
	assert.equal(chainTipResult.tip, 'sync-tip');

	// --- awaited chain tip: await new Root(...).AsyncNested(...) -----------
	const awaitedChainTip = await new MechanicsAsyncChainRoot({ value: 3 }).MechanicsAsyncChainTip({ delay: 1 });
	assert.ok(awaitedChainTip instanceof MechanicsAsyncChainTip, 'awaited chain tip constructs the async nested type');
	assert.equal(awaitedChainTip.delay, 1);

	// --- awaited fork of an async-constructed instance ---------------------
	const mechanicsAsync = await new MechanicsAsyncRoot({ value: 7 });
	const awaitedFork = await mechanicsAsync.fork();
	assert.ok(awaitedFork instanceof MechanicsAsyncRoot, 'awaited fork re-runs the async constructor');
	assert.equal(awaitedFork.value, 7);
	assert.strictEqual(utils.parent(awaitedFork), mechanicsAsync);

	const awaitedForkFresh = await mechanicsAsync.fork({ value: 42 });
	assert.equal(awaitedForkFresh.value, 42);

	const mechanics = [
		'fork() no-args',
		'fork() fresh args',
		'clone property',
		'clone call',
		'utils.merge(a, b)',
		'call(entity, Ctor, ...)',
		'apply(entity, Ctor, [...])',
		'bind(entity, Ctor)(...)',
		'chain tip new R().A()',
		'awaited chain tip',
		'awaited fork()',
		'awaited fork() fresh args',
	];
	return mechanics;
};
