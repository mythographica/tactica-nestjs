import {
	Body,
	Controller,
	Get,
	Post,
	Query,
	Req,
	Res,
	UseFilters,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { lookup, utils } from 'mnemonica';
import { wrap, enterContext, getFlow } from '@mnemonica/dive';
import { parkCrash } from './crash-park';
import { consumeMessage, awaitTask } from './fake-queue';
import type { queueMessage } from './fake-queue';
import { TraceExceptionFilter } from './trace-exception.filter';

const UserEntity = lookup('UserEntity');

/**
 * The demo-trust token: random unless the caller supplied their own
 * (body.mark or ?mark=). Travels response → instance → error message →
 * crash report, so watchers see THIS request's data in the failure.
 */
function markOf (given: unknown): string {
	if (typeof given === 'string' && given.length > 0) {
		const result = given;
		return result;
	}
	const result = crypto.randomUUID().split('-')[0];
	return result;
}

/**
 * extract() that cannot throw inside an error path — non-mnemonica
 * values degrade to their key list.
 */
function extractSafe (instance: object): unknown {
	try {
		const result = utils.extract(instance);
		return result;
	} catch {
		const result = Object.keys(instance);
		return result;
	}
}

/**
 * Chaos Controller — load-test and error-trace fixture.
 *
 * Three behaviours:
 *   GET  /chaos/ok     — control path: wrapped work + instance creation
 *   POST /chaos/crash  — wrapped callback throws on the next tick, escaping
 *                        Nest's exception filter → REAL process
 *                        'uncaughtException' (kept alive by the listener
 *                        installed in main.ts)
 *   POST /chaos/reject — wrapped callback returns a dangling rejected
 *                        promise → REAL process 'unhandledRejection'
 *
 * The mnemonica instance created per request is passed as dive's wrap
 * context, so the failing edge hangs off that instance's branch and
 * getFlow(error) reconstructs the whole story.
 *
 * Demo-trust device (2026-09-02, Viktor): every endpoint mints a random
 * `mark` token (body.mark / ?mark= overrides it, so a watcher can supply
 * their OWN value). The mark travels: HTTP response → mnemonica instance
 * payload → error message → the process-level crash report's extracted
 * instance. Nothing hardcoded: the crash line provably carries THIS
 * request's data.
 *
 * Parked-response pair (2026-09-02): crash_un_response / crash_int_response
 * PARK the raw response (@Res, no passthrough), let the grenade escape to
 * the process-level handler, and the handler answers the parked socket
 * with HTTP 500 + the full crash report. crash_int_response additionally
 * wears the interceptor-stamped `imark` (see mark.interceptor.ts), so the
 * demo table reads: watcher mark → interceptor imark → crash payload.
 */
@ApiTags('chaos')
@Controller('chaos')
export class ChaosController {

	@Get('ok')
	@ApiOperation({
		summary: 'Control endpoint',
		description: 'Normal wrapped path with an instance creation — for sustained load. ?mark= overrides the random mark',
	})
	@ApiQuery({ name: 'mark', required: false, description: 'Demo-trust token — defaults to random hex' })
	@ApiResponse({ status: 200, description: 'Control path executed' })
	ok (@Query('mark') queryMark?: string): { status: string; id: string; mark: string } {
		const id = crypto.randomUUID();
		const mark = markOf(queryMark);
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-${mark}-${id}`,
		});

		// Same explicit-context pattern as crash/reject/delayed below: without
		// the instance passed here, this wrapped call would inherit the LAST
		// ambient mnemonica instance as its context (dive's newest-wins
		// lastContext) and its edge would wear a foreign instanceType —
		// observed live: an unrelated WS-channel construction painted this
		// endpoint's call edge with ITS type.
		const worker = wrap(() => {
			const result = user.constructor.name;
			return result;
		}, user, 'chaos:ok');

		const typeName = worker();
		const result = { status: 'ok', id, mark, typeName };
		return result;
	}

	@Post('crash')
	@ApiOperation({
		summary: 'Trigger a real uncaughtException',
		description: 'Schedules a wrapped throw on the next tick — escapes Nest exception filters',
	})
	@ApiResponse({ status: 201, description: 'Crash scheduled' })
	crash (@Body() body?: { mark?: string }): { status: string; id: string; mark: string } {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-${mark}-${id}`,
		});

		// The throw happens OUTSIDE the request/response cycle, in a wrapped
		// callback whose execution parent is the instance above — so dive
		// pins the error to this branch before it reaches the process.
		const grenade = wrap(() => {
			throw new Error(`chaos-crash:${id}:${mark}`);
		}, user, 'chaos:crash');

		setImmediate(grenade);

		const result = { status: 'crash-scheduled', id, mark };
		return result;
	}

	@Post('reject')
	@ApiOperation({
		summary: 'Trigger a real unhandledRejection',
		description: 'Returns a dangling rejected promise from a wrapped callback',
	})
	@ApiResponse({ status: 201, description: 'Rejection scheduled' })
	reject (@Body() body?: { mark?: string }): { status: string; id: string; mark: string } {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-${mark}-${id}`,
		});

		const grenade = wrap(() => {
			const result = Promise.reject(new Error(`chaos-reject:${id}:${mark}`));
			return result;
		}, user, 'chaos:reject');

		// Deliberately NOT awaited/caught — the rejection stays dangling.
		setImmediate(grenade);

		const result = { status: 'reject-scheduled', id, mark };
		return result;
	}

	@Post('delayed')
	@ApiOperation({
		summary: 'Delayed wrapped callback with disconnected data',
		description: 'The wrapped callback fires 100ms AFTER the instance was created and replies with JSON-round-tripped (disconnected) data; body.outcome picks the path: ok → response, reject → unhandledRejection, throw → uncaughtException',
	})
	@ApiResponse({ status: 201, description: 'Delayed outcome executed or scheduled' })
	async delayed (@Body() body: { outcome?: string; mark?: string }): Promise<unknown> {
		const id = crypto.randomUUID();
		const outcome = body && typeof body.outcome === 'string' ? body.outcome : 'ok';
		const mark = markOf(body?.mark);
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-${mark}-${id}`,
		});

		// The wrapped callback IS the timer tick: it runs 100ms after the
		// mnemonica instance settled, so the trace must reach past the
		// construction edges. Its payload is DISCONNECTED data — a JSON
		// round-trip of the instance, no live reference crosses back.
		const grenade = wrap(() => {
			const disconnected = JSON.parse(JSON.stringify(user));
			if (outcome === 'throw') {
				throw new Error(`chaos-delayed-throw:${id}:${mark}`);
			}
			if (outcome === 'reject') {
				// Deliberately dangling — the rejection stays unhandled.
				const dangling = Promise.reject(new Error(`chaos-delayed-reject:${id}:${mark}`));
				return dangling;
			}
			return disconnected;
		}, user, `chaos:delayed:${outcome}`);

		if (outcome === 'ok') {
			const data = await new Promise((resolve) => {
				setTimeout(() => {
					const produced = grenade();
					resolve(produced);
				}, 100);
			});
			const result = { status: 'ok', id, mark, data };
			return result;
		}

		// reject/throw: deliberately NOT awaited — the failure escapes the
		// request/response cycle exactly like crash/reject above.
		setTimeout(grenade, 100);

		const result = { status: `${outcome}-scheduled`, id, mark };
		return result;
	}

	@Post('pure-error')
	@ApiOperation({
		summary: 'Wrapped error with NO mnemonica instance',
		description: 'Proof that dive wrapper errors differ from mnemonica errored instances: this branch carries zero types',
	})
	@ApiResponse({ status: 201, description: 'Pure error scheduled' })
	pureError (@Body() body?: { mark?: string }): { status: string; id: string; mark: string } {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);

		// No instance created, no context instance passed — AND the ambient
		// dive context is cleared first: without enterContext(undefined) the
		// wrapped call would inherit the LAST active mnemonica instance as
		// its context (dive's newest-wins cursor), and the "pure" error
		// would still show a foreign instanceType. A mnemonica errored
		// instance carries create edges + instanceType; this trace must
		// show neither. The mark rides the error message only — there is
		// deliberately no instance to carry it.
		enterContext(undefined);
		const grenade = wrap(() => {
			throw new Error(`chaos-pure:${id}:${mark}`);
		}, 'chaos:pure-error');

		setImmediate(grenade);

		const result = { status: 'pure-error-scheduled', id, mark };
		return result;
	}

	@Post('crash_un_response')
	@ApiOperation({
		summary: 'uncaughtException that answers its own request',
		description: 'Parks the response, throws on the next tick; the process-level handler answers the parked socket with HTTP 500 + the crash report',
	})
	@ApiResponse({ status: 500, description: 'Crash report delivered as the response body' })
	async crashUnResponse (@Body() body: { mark?: string } | undefined, @Res() res: Response): Promise<void> {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-un-${mark}-${id}`,
		});

		// Same escape as /chaos/crash — but the response is PARKED below, so
		// the process-level handler can answer THIS request with the report.
		// The mark stays the LAST ':'-separated segment: main.ts parses it
		// from error.message to find the parked entry.
		const grenade = wrap(() => {
			throw new Error(`chaos-crash-un:${id}:${mark}`);
		}, user, 'chaos:crash-un-response');

		setImmediate(grenade);

		// @Res() without passthrough: Nest never auto-sends. The gate
		// resolves when the process-level uncaughtException handler answers
		// res.status(500).json(report) — or when the park timeout fires.
		const gate = parkCrash(mark, res);
		await gate;
	}

	@Post('crash_int_response')
	@ApiOperation({
		summary: 'uncaughtException answered with interceptor correlation',
		description: 'Like crash_un_response, plus the interceptor-stamped imark (x-imark overrides it) — the crash report carries both tokens',
	})
	@ApiResponse({ status: 500, description: 'Crash report delivered as the response body' })
	async crashIntResponse (@Body() body: { mark?: string } | undefined, @Req() req: Request, @Res() res: Response): Promise<void> {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);
		// Stamped by MarkInterceptor (app.module.ts APP_INTERCEPTOR); the
		// fallback string should never appear in practice.
		const imark = (req as Request & { imark?: string }).imark ?? 'unstamped';
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-int-${mark}-${imark}-${id}`,
		});

		// mark stays LAST (park lookup key); imark rides the middle so the
		// crash report carries the full chain watcher → interceptor → crash.
		const grenade = wrap(() => {
			throw new Error(`chaos-crash-int:${id}:${imark}:${mark}`);
		}, user, 'chaos:crash-int-response');

		setImmediate(grenade);

		const gate = parkCrash(mark, res);
		await gate;
	}

	@Post('mid_sleep')
	@ApiOperation({
		summary: 'Survives a middleware timer throwing mid-sleep',
		description: 'Middleware set a 100ms timer; the handler creates UserEntity + UserResponse, then sleeps 1000ms. The timer throws at 100ms → uncaughtException; the request answers 201 "survived" after its sleep. The crash trace connects through ANCESTORS (the construction chain), not wrap predecessors',
	})
	@ApiResponse({ status: 201, description: 'Request survived its own assassin' })
	async midSleep (@Body() body: { mark?: string } | undefined, @Req() req: Request): Promise<{ status: string; id: string; mark: string }> {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-midsleep-${mark}-${id}`,
		});
		// The second instance, constructed FROM the first — its branch IS
		// the ancestor chain the timer's crash will hang off:
		// create:UserEntity → create:UserResponse → call:mid-sleep-timer.
		const userResponse = new user.UserResponse({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-midsleep-response-${mark}-${id}`,
			type: 'user',
		});

		// The middleware timer (already ticking) reads this stash when it
		// fires at 100ms and wraps its throw with userResponse as context.
		(req as Request & { chaosMidSleep?: unknown }).chaosMidSleep = { id, mark, userResponse };

		// Standard sleep pattern: the response only comes after the full
		// 1000ms — the crash happens 900ms before this request answers.
		const sleep = new Promise<void>((resolve) => {
			setTimeout(resolve, 1000);
		});
		await sleep;

		const result = { status: 'survived', id, mark };
		return result;
	}

	@Post('blindspot')
	@ApiOperation({
		summary: 'Queue reply fails sanity; crafting the error response fails too (BLIND side)',
		description: 'Middleware timer answers the awaited queue message 100ms in (Kafka request-reply emulation). The reply fails the sanity marker → business rules demand a throw → crafting the error response dies INSIDE the UserResponse constructor. The [mist] stdout report carries everything — but Nest\'s DEFAULT exception filter answers the client with the blind {"statusCode":500} default. This is the fog side; /chaos/unblinding is the taught side',
	})
	@ApiResponse({ status: 500, description: 'Blind Nest default — the client learns nothing' })
	async blindspot (@Body() body: { mark?: string } | undefined, @Req() req: Request): Promise<unknown> {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-mist-${mark}-${id}`,
		});

		// "We sent something to kafka and await the reply": the middleware
		// minted this request's queue key; its timer produces the reply
		// ~100ms in. This await IS the in-method queue handler.
		const queueKey = (req as Request & { mistPlusQueueKey?: string }).mistPlusQueueKey;
		if (!queueKey) {
			throw new Error('blindspot: no queue key stashed — MistPlusMiddleware not registered for this route');
		}
		const message = await consumeMessage(queueKey);

		if (message.sane) {
			// The happy path, for completeness: never taken by the fixture's
			// own producer (it always sends sane: false).
			const crafted = new user.UserResponse({
				id,
				email: `${mark}@chaos.local`,
				name: `chaos-mist-ok-${mark}-${id}`,
				type: 'user',
			});
			const result = { status: 'ok', id, mark, data: extractSafe(crafted) };
			return result;
		}

		// Business rules: the remote reply failed sanity, so we MUST throw.
		// The throw path crafts a UserResponse for the error payload — but
		// the same failed sanity lives inside its constructor now
		// (user.entity.ts), so the CONSTRUCTOR throws instead. What
		// propagates is the construction error.
		const responsePayload = {
			id,
			email : `${mark}@chaos.local`,
			name  : `sanity-failed:${message.detail}:${mark}`,
			type  : 'user' as const,
		};
		const queueHandler = wrap((msg: queueMessage) => {
			const crafted = new user.UserResponse({
				...responsePayload,
				name : `sanity-failed:${msg.detail}:${mark}`,
			});
			return crafted;
		}, user, 'chaos:mist-plus-queue-handler');

		try {
			const crafted = queueHandler(message);
			// Unreachable on the insane path — the constructor throws first.
			const result = { status: 'unexpected-ok', id, mark, data: extractSafe(crafted) };
			return result;
		} catch (caught) {
			const error = caught as Error;
			const flow = getFlow(error);
			// Probe findings (2026-09-02): mnemonica does NOT attach the
			// errored instance to the thrown error, and the errored instance
			// itself has ZERO own keys — constructHandler assignments are
			// rolled back on throw (type identity survives: constructor.name
			// is UserResponse; fields read through to the parent prototype).
			// So: getErrorInstance returns the wrap's CONTEXT (user); the
			// errored create edge carries the type shell; the attempted
			// payload is only recoverable from the constructor ARGS — which
			// we have here as responsePayload.
			const erroredEdge = [...flow].reverse().find((edge) => edge.kind === 'create');
			const erroredResponse = erroredEdge?.instance;
			const report = {
				kind             : 'nest-caught-business-error',
				message          : error.message,
				queue            : message,
				branch           : flow.map((edge) => `${edge.kind}:${edge.name}`),
				userInstance     : extractSafe(user),
				erroredType      : erroredEdge?.name ?? null,
				erroredInstance  : erroredResponse ? extractSafe(erroredResponse) : null,
				attemptedPayload : responsePayload,
			};
			// The demo table in one line: queue handler edge + user +
			// errored UserResponse + the actual error. Then rethrow so Nest
			// answers 500 — a business error, the process was never at risk.
			console.log(`[mist] ${JSON.stringify(report)}`);
			throw error;
		}
	}

	@Post('unblinding')
	@UseFilters(TraceExceptionFilter)
	@ApiOperation({
		summary: 'Same queue-sanity failure as blindspot — but Nest is TAUGHT',
		description: 'Identical mechanics to /chaos/blindspot (queue await → sanity fails → UserResponse constructor throws), except the route stays natural: no try/catch here at all. The TraceExceptionFilter answers 500 with the dive branch + errored construction + actual error AS the body, and records an OTel error span so Jaeger sees the failure too',
	})
	@ApiResponse({ status: 500, description: 'Unblinded — the trace IS the response body' })
	async unblinding (@Body() body: { mark?: string } | undefined, @Req() req: Request): Promise<unknown> {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-unblind-${mark}-${id}`,
		});

		const queueKey = (req as Request & { mistPlusQueueKey?: string }).mistPlusQueueKey;
		if (!queueKey) {
			throw new Error('unblinding: no queue key stashed — MistPlusMiddleware not registered for this route');
		}
		const message = await consumeMessage(queueKey);

		if (message.sane) {
			const crafted = new user.UserResponse({
				id,
				email: `${mark}@chaos.local`,
				name: `chaos-unblind-ok-${mark}-${id}`,
				type: 'user',
			});
			const result = { status: 'ok', id, mark, data: extractSafe(crafted) };
			return result;
		}

		// Same business-rule throw path as blindspot — but deliberately NO
		// try/catch: the route stays dumb, the TraceExceptionFilter does the
		// seeing. That is the whole demo: the boundary speaks trace instead
		// of serving the blind default.
		const responsePayload = {
			id,
			email : `${mark}@chaos.local`,
			name  : `sanity-failed:${message.detail}:${mark}`,
			type  : 'user' as const,
		};
		const queueHandler = wrap((msg: queueMessage) => {
			const crafted = new user.UserResponse({
				...responsePayload,
				name : `sanity-failed:${msg.detail}:${mark}`,
			});
			return crafted;
		}, user, 'chaos:unblinding-queue-handler');

		const crafted = queueHandler(message);
		// Unreachable on the insane path — the constructor throws first and
		// the filter answers.
		const result = { status: 'unexpected-ok', id, mark, data: extractSafe(crafted) };
		return result;
	}

	@Post('corner_cut')
	@UseFilters(TraceExceptionFilter)
	@ApiOperation({
		summary: 'The lazybones cascade: untyped task id on req, any-typed payload into a constructor',
		description: 'Middleware fires a queue task and FORGETS it, stashing the task id as an untyped attachment on req. The handler awaits the task result (shortened outbox), feeds the any-typed payload into UserResponse — malformed data explodes INSIDE the constructor. body.flavor: typeerror (default, Nest blind-500) | circular (throws the non-Error payload itself) | headers (writes a partial response first — the filter\'s own reply then fails)',
	})
	@ApiResponse({ status: 500, description: 'One of the thousand headshot variants' })
	async cornerCut (@Body() body: { mark?: string; flavor?: string } | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<unknown> {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);
		const flavor = body?.flavor ?? 'typeerror';
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-corner-${mark}-${id}`,
		});

		// The corner cut: read the untyped attachment back off the request.
		// No contract, no guard in real life — the check here exists only so
		// a misconfigured route says something truthful.
		const taskId = (req as Request & { taskId?: unknown }).taskId;
		if (typeof taskId !== 'string') {
			throw new Error('corner_cut: no task id attached — CornerCutMiddleware not registered for this route');
		}

		// Shortened outbox: await the queue for the task result. Typed
		// `any` on purpose — that is exactly how such code arrives at the
		// constructor with no structure guarantee at all.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const payload: any = await awaitTask(taskId);

		if (flavor === 'circular') {
			// The classic: throwing the DATA, not an Error. The payload is
			// self-referencing — whatever tries to serialize it next is in
			// for a surprise.
			throw payload;
		}

		if (flavor === 'headers') {
			// Response already started by hand; the failure below then
			// meets a filter whose own reply lands on sent headers.
			res.write('partial-answer');
		}

		const craft = wrap((data: { name?: string }) => {
			// data.name is undefined on the malformed payload: the explosion
			// happens INSIDE the constructHandler (data.name.includes in the
			// UserResponse sanity check) — a TypeError wearing an errored
			// mnemonica instance.
			const crafted = new user.UserResponse({
				id,
				email: `${mark}@chaos.local`,
				name: data.name as string,
				type: 'user',
			});
			return crafted;
		}, user, 'chaos:corner-cut-craft');

		const crafted = craft(payload);
		// Unreachable on every malformed flavor.
		const result = { status: 'unexpected-ok', id, mark, data: extractSafe(crafted) };
		return result;
	}

	@Post('nested')
	@ApiOperation({
		summary: 'Nested wraps — a generation chain for the wrappers graph',
		description: 'A wrap() INSIDE a wrapped callback: the inner entry\'s via points at the outer call site, so Mnemographica renders gen-0 → gen-1 instead of gen-0 islands',
	})
	@ApiResponse({ status: 201, description: 'Nested wrap executed' })
	nestedWraps (@Body() body?: { mark?: string }): { status: string; id: string; mark: string; inner: string } {
		const id = crypto.randomUUID();
		const mark = markOf(body?.mark);
		const user = new UserEntity({
			id,
			email: `${mark}@chaos.local`,
			name: `chaos-nested-${mark}-${id}`,
		});

		// Textual nesting is what tactica's `via` records: the inner wrap
		// sits in the outer wrapped body, so dive wraps it at runtime when
		// the outer runs — gen-0 outer, gen-1 inner, one generation edge.
		const worker = wrap(() => {
			const inner = wrap(() => {
				const text = `inner:${user.name}`;
				return text;
			}, user, 'chaos:nested:inner');
			const text = inner();
			return text;
		}, user, 'chaos:nested:outer');

		const inner = worker();
		const result = { status: 'ok', id, mark, inner };
		return result;
	}
}
