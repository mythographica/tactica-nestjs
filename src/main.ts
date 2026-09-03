import 'reflect-metadata';
// OTEL must register before any wrapped construction records an edge.
import { initTracing } from './tracing';
initTracing();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { defaultTypes, lookup, utils, getProps } from 'mnemonica';
import type { hooksOpts } from 'mnemonica';
import { MnemonicaOtelProvider, MnemonicaTraceMiddleware, AsyncFlowProvider } from '@mnemonica/nestjs';
import { bootstrapStrategyChannel } from './strategy-channel';
import { getFlow, getErrorInstance, getRunningEdges, setTraceLimit } from '@mnemonica/dive';
import * as divePkg from '@mnemonica/dive';
import { resolveCrash } from './crash-park';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { Request, Response, NextFunction } from 'express';
import '../.tactica/registry'; // Augments mnemonica's TypeRegistry
import { bootstrapAITypes } from './ai-types/bootstrap';
import type { Sentience, Sentience_Memory } from '../.tactica/types';

// Ring experiment (2026-09-02, Viktor): memory watch + ring/weak gates.
// DIVE_RING: unset → library default (UNBOUNDED since dive's 2026-09-02
// flip); an integer (e.g. 1024) → setTraceLimit(n) restores a bound;
// 'unbounded' also accepted for the 2026-09-02 scripts.
// DIVE_WEAK=1 / DIVE_STRONG=1 → instance storage override (dive's
// default is WEAK since 2026-09-02). MEM_WATCH=1 prints
// memoryUsage every second; under node --expose-gc every 10th tick
// forces GC first, so the post-load floor is visible without waiting
// on natural collection.
type weakRefsApi = {
	setWeakInstanceRefs?: (enable: boolean) => void;
	getCollectedInstanceCount?: () => number;
};
const diveWeakApi = divePkg as weakRefsApi;
const diveRing = process.env.DIVE_RING;
if (diveRing !== undefined && diveRing !== '') {
	const parsed = diveRing === 'unbounded' ? Number.MAX_SAFE_INTEGER : Number.parseInt(diveRing, 10);
	if (Number.isInteger(parsed) && parsed >= 0) {
		setTraceLimit(parsed);
		const label = parsed === Number.MAX_SAFE_INTEGER ? 'UNBOUNDED (eviction disabled)' : String(parsed);
		console.log(`[memwatch] dive ring limit: ${label}`);
	} else {
		console.warn(`[memwatch] DIVE_RING="${diveRing}" not understood — library default stays`);
	}
}
// Weak/strong half of the experiment: dive's default is WEAK since
// 2026-09-02 (edge.instance a WeakRef — the payload is GC-releasable,
// the skeleton stays, the registry notifies). DIVE_STRONG=1 opts out
// (reproduces experiment 1's pin); DIVE_WEAK=1 stays accepted as an
// explicit-on for pre-default dive builds. The API is accessed
// dynamically so this file still compiles against a pre-weak-refs dive
// (Viktor keeps one on a backup branch): missing exports degrade to a
// logged skip, and old dive + no env = strong refs = experiment 1 too.
const hasWeakApi = typeof diveWeakApi.setWeakInstanceRefs === 'function';
if (process.env.DIVE_STRONG === '1') {
	if (hasWeakApi) {
		const setWeak = diveWeakApi.setWeakInstanceRefs;
		setWeak?.(false);
		console.log('[memwatch] dive instance refs STRONG (opt-out via DIVE_STRONG=1 — experiment 1 mode)');
	} else {
		console.log('[memwatch] dive instance refs STRONG (pre-weak-refs dive — experiment 1 mode)');
	}
} else if (process.env.DIVE_WEAK === '1') {
	const setWeak = diveWeakApi.setWeakInstanceRefs;
	if (setWeak) {
		setWeak(true);
		console.log('[memwatch] dive instance refs WEAK (explicit DIVE_WEAK=1)');
	} else {
		console.warn('[memwatch] DIVE_WEAK=1 but this dive has no setWeakInstanceRefs — STRONG refs stay (that IS experiment 1)');
	}
} else {
	console.log(`[memwatch] dive instance refs ${hasWeakApi ? 'WEAK (library default)' : 'STRONG (pre-weak-refs dive)'}`);
}
const weakActive = hasWeakApi && process.env.DIVE_STRONG !== '1';
if (process.env.MEM_WATCH === '1') {
	const countCollected = diveWeakApi.getCollectedInstanceCount;
	let tick = 0;
	const mb = (bytes: number): string => {
		const result = (bytes / 1024 / 1024).toFixed(1);
		return result;
	};
	const timer = setInterval(() => {
		tick++;
		const globalWithGc = global as typeof global & { gc?: () => void };
		const gcForced = typeof globalWithGc.gc === 'function' && tick % 10 === 0;
		if (gcForced) {
			globalWithGc.gc();
		}
		const mem = process.memoryUsage();
		const forced = gcForced ? ' (gc forced)' : '';
		const collected = weakActive && countCollected ? ` collected=${countCollected()}` : '';
		console.log(`[memwatch] rss=${mb(mem.rss)}MB heap=${mb(mem.heapUsed)}/${mb(mem.heapTotal)}MB ext=${mb(mem.external)}MB${collected}${forced}`);
	}, 1000);
	timer.unref();
}

// Bootstrap AI consciousness types from directory structure
bootstrapAITypes();

// Get existing Sentience type using type-safe lookup
const SentienceConstructor = lookup('Sentience');

declare global {
	// eslint-disable-next-line no-var
	var aiMemories: {
		rootInstance: Sentience | null;
		memories: Map<string, {
			id: string;
			instance: Sentience_Memory;
			createdAt: string;
		}>;
		count: number;
	};
}

// Restore memories from persistence file on startup
function restoreMemoriesOnStartup() {
	try {
		const fs = require('fs');
		const path = require('path');

		// dist/src/main.js -> ../../ is the project root
		const memoryFilePath = path.join(__dirname, '../../ai-memories.json');

		if (fs.existsSync(memoryFilePath)) {
			const data = JSON.parse(fs.readFileSync(memoryFilePath, 'utf-8'));

			if (!global.aiMemories) {
				global.aiMemories = {
					rootInstance: null,
					memories: new Map(),
					count: 0
				};
			}

			if (!SentienceConstructor) {
				console.log('[Memory System] Warning: Sentience type not found, skipping memory restoration');
				return;
			}

			// Create root instance if needed
			if (global.aiMemories.rootInstance === null) {
				global.aiMemories.rootInstance = new SentienceConstructor({
					awareness: 'AI Sentience System',
					identity: 'AI Agent'
				});
			}

			// Restore memories
			if (data.memories && data.memories.items) {
				let restoredCount = 0;
				data.memories.items.forEach(function (item) {
					const memoryId = item.id;

					const memoryInstance = new global.aiMemories.rootInstance.Memory({
						content: item.content,
						emotion: item.emotion,
						intensity: item.intensity,
						topic: item.topic
					});

					global.aiMemories.memories.set(memoryId, {
						id: memoryId,
						instance: memoryInstance,
						createdAt: item.createdAt || new Date().toISOString()
					});

					restoredCount++;
				});

				global.aiMemories.count = restoredCount;
				console.log(`[Memory System] Restored ${restoredCount} memories from ${memoryFilePath}`);
			}
		} else {
			console.log('[Memory System] No persistence file found, starting fresh');
		}
	} catch (e) {
		console.error('[Memory System] Error restoring memories:', e.message);
	}
}

// Restore memories on startup
restoreMemoriesOnStartup();

/**
 * NestJS Bootstrap with Swagger
 * Demonstrates integration with mnemonica and typeomatica
 */
async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Per-request OTel span (the adapter's mtm): this is the span the dive
	// branch and the construction spans nest under, so one HTTP request
	// reads as ONE joined trace in Jaeger. Constructed manually — the
	// middleware's Tracer parameter is an interface type, so Nest's DI
	// cannot resolve it (design:paramtypes collapses it to Object).
	const otel = app.get(MnemonicaOtelProvider, { strict: false });
	// Present because AppModule sets asyncFlow: true — also handed to the
	// crash handlers below via the module-level binding.
	asyncFlowProvider = app.get(AsyncFlowProvider, { strict: false });
	const mtm = new MnemonicaTraceMiddleware(trace.getTracer('tactica-nestjs'), otel, asyncFlowProvider);
	app.use((req: Request, res: Response, next: NextFunction) => mtm.use(req, res, next));

	// Enable global validation pipe
	app.useGlobalPipes(new ValidationPipe({
		transform: true,
		whitelist: true,
		forbidNonWhitelisted: true,
	}));

	// Setup Swagger
	const config = new DocumentBuilder()
		.setTitle('NestJS + Mnemonica Example')
		.setDescription('Example API demonstrating NestJS with mnemonica runtime inheritance')
		.setVersion('1.0')
		.addTag('users', 'User management')
		.addTag('admins', 'Admin management with inheritance')
		.addTag('super-admins', 'SuperAdmin management with 3-level inheritance')
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api-docs', app, document);

	const port = process.env.PORT || 3000;
	await app.listen(port);

	// Self-hosted Strategy WS channel: no --inspect, no CDP — the app owns
	// the switch (env-gated, see strategy-channel.ts).
	await bootstrapStrategyChannel();

	console.log(`NestJS server running on http://localhost:${port}`);
	console.log(`Swagger API docs available at http://localhost:${port}/api-docs`);
	console.log('');
	console.log('Available endpoints:');
	console.log('  POST /users           - Create user');
	console.log('  GET  /users/:id       - Get user');
	console.log('  POST /admins          - Create admin (with inheritance)');
	console.log('  GET  /admins/:id      - Get admin');
	console.log('  POST /super-admins    - Create superadmin (3-level inheritance)');
	console.log('  GET  /super-admins/:id - Get superadmin');
	console.log('');
	console.log('Async/Await + @decorate() Examples:');
	console.log('  POST /async/root-async              - Async constructor');
	console.log('  POST /async/root-async/result       - Async chain (RootAsync -> ResultFromDecorate)');
	console.log('  POST /async/sync-base/sub-async     - @decorate() class with async sub-type');
	console.log('  POST /async/sync-base/sub-async/sub-decorate - Full async chain with decorate');
}

bootstrap();

// Register mnemonica hooks for the default collection
// These hooks log constructor names when instances are created

// Dive lifecycle wiring lives in the adapter module path now:
// MnemonicaModule.forRoot({ thunderstruck: true }) in AppModule calls
// attachHooks(defaultTypes) itself (and registers the pre-root
// interceptor), so every construction records a 'create' edge in dive's
// execution-flow trace (dumpable live via strategy's rpc_dive_trace).

// Process-level error handlers for the chaos endpoints.
//
// Listeners keep the process ALIVE under sustained load (Node only exits on
// uncaughtException/unhandledRejection when nobody listens). Each handler
// reconstructs the failing branch from dive's flight recorder and enriches
// the report with the pinned instance's plain-data fields via mnemonica's
// extract() — one structured JSON line per failure for downstream tooling.
// Process-level failures usually escape the request's OTEL context (the throw
// crosses setImmediate / a dangling promise). With tracing.ts registering a
// global AsyncLocalStorage context manager, a failure that stays inside the
// request's async resource now parents onto the request span automatically;
// one that truly escapes still emits as a one-shot root span: ERROR status +
// the recorded exception, so Jaeger's error search (with_errors) finds them.
//
// 2026-09-02 — the crash loop closes: the adapter's AsyncFlowProvider ALS
// backbone (asyncFlow: true in AppModule) hands the handler the failing
// execution's frame (parental edgeId + pinned instances, no lastContext
// guessing), and dive's getRunningEdges() names the still-unfinished
// fibers — the suspect set. Extract-and-ship happens HERE, synchronously:
// after the handler returns, GC owns the payloads.
let asyncFlowProvider: AsyncFlowProvider | undefined;

function extractSafe (instance: object): unknown {
	try {
		const result = utils.extract(instance);
		return result;
	} catch {
		// not a mnemonica instance — summarize without throwing in a handler
		const result = Object.keys(instance);
		return result;
	}
}

function recordProcessErrorSpan(kind: string, error: Error, branch: string[], frameEdgeId: number | null, runningCount: number) {
	const span = trace.getTracer('tactica-nestjs').startSpan(`process.${kind}`);
	span.setAttribute('process.error.kind', kind);
	span.setAttribute('dive.branch', branch.join(' → '));
	if (frameEdgeId !== null) {
		span.setAttribute('dive.frame_edge_id', frameEdgeId);
	}
	span.setAttribute('dive.running_count', runningCount);
	span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
	span.recordException(error);
	span.end();
}

function processErrorReport (kind: string, error: Error): void {
	const flow = getFlow(error);
	const instance = getErrorInstance(error);
	const frame = asyncFlowProvider?.currentFrame();
	const running = getRunningEdges();
	// Errored-construction walk (2026-09-03): if the failure IS a failed
	// mnemonica construction, the caught error is the errored instance
	// itself and core's getProps exposes the attempted constructor args
	// (the shell rolled its own fields back; the args survive in props).
	// Non-mnemonica errors yield undefined and the keys stay out.
	const erroredEdge = [...flow].reverse().find((edge) => edge.kind === 'create' && edge.status === 'error');
	let attemptedArgs: unknown;
	try {
		const props = getProps(error) as { args?: unknown } | undefined;
		attemptedArgs = props?.args;
	} catch {
		attemptedArgs = undefined;
	}
	const report = {
		kind,
		message  : error.message,
		branch   : flow.map((edge) => `${edge.kind}:${edge.name}`),
		instance : instance ? utils.extract(instance) : null,
		frame    : frame
			? { edgeId: frame.edgeId, instances: frame.instances.map(extractSafe) }
			: null,
		running  : running.map((edge) => `${edge.id}:${edge.kind}:${edge.name}`),
		...(attemptedArgs !== undefined
			? { erroredType: erroredEdge?.name ?? null, attemptedArgs }
			: {}),
	};
	// Demo closure (2026-09-02): if this failure belongs to a parked
	// /chaos/crash_*_response request, answer its parked socket with
	// HTTP 500 + this report. Park key = the LAST ':'-separated segment of
	// error.message — the chaos endpoints put the mark there on purpose.
	// Other failures (chaos-crash, chaos-pure, ...) have no parked entry
	// and resolveCrash returns false: log-only, exactly as before.
	const segments = error.message.split(':');
	const mark = segments[segments.length - 1];
	const answered = resolveCrash(mark, report);
	console.log(`[chaos] answered=${answered} ${JSON.stringify(report)}`);
	recordProcessErrorSpan(kind, error, report.branch, frame?.edgeId ?? null, running.length);
}

process.on('uncaughtException', (error: Error) => {
	processErrorReport('uncaughtException', error);
});

process.on('unhandledRejection', (reason: unknown) => {
	const error = reason instanceof Error ? reason : new Error(String(reason));
	processErrorReport('unhandledRejection', error);
});

// Pre-creation hook - logs before instance creation
defaultTypes.registerHook('preCreation', (opts: hooksOpts) => {
	console.log(`[mnemonica hook] preCreation: About to create ${opts.TypeName}`);
});

// Post-creation hook - logs after instance creation with constructor name
defaultTypes.registerHook('postCreation', (opts: hooksOpts) => {
	const instance = opts.inheritedInstance;
	console.log(`[mnemonica hook] postCreation: Created instance of ${instance?.constructor.name}`);
});
