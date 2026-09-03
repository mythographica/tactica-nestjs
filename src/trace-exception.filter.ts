import { Catch, HttpException } from '@nestjs/common';
import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { getFlow } from '@mnemonica/dive';
import { utils, getProps } from 'mnemonica';
import { trace, SpanStatusCode } from '@opentelemetry/api';

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
 * The attempted constructor args of a FAILED mnemonica construction ride
 * the errored instance itself: the caught object IS the errored shell
 * (probed 2026-09-03: caught === creationError's inheritedInstance,
 * instanceof Error via the spliced prototype chain), and core's own
 * getProps exposes { args, originalError, … } off the props WeakMap.
 * Plain errors yield undefined; anything unexpected degrades, never
 * throws inside a filter.
 */
function erroredArgsSafe (error: Error): unknown {
	try {
		const props = getProps(error) as { args?: unknown } | undefined;
		const result = props?.args;
		return result;
	} catch {
		const result = undefined;
		return result;
	}
}

/**
 * JSON.stringify that cannot throw inside an error path — circular or
 * hostile values degrade to a marker instead of crashing the filter
 * (a throwing filter is exactly the cascade this demo fights).
 */
function stringifySafe (value: unknown): string {
	try {
		const result = JSON.stringify(value);
		return result;
	} catch {
		const result = '"[unserializable report payload]"';
		return result;
	}
}

/**
 * SUPERSEDED (2026-09-03): this implementation moved upstream into the
 * adapter as `MnemonicaExceptionFilter` (@mnemonica/nestjs >
 * 0.7.7, src/filters/mnemonica-exception.filter.ts). This local copy stays
 * until the adapter is published — tactica-nestjs runs on PUBLIC npm
 * deps, and the published 0.7.7 does not export the filter yet.
 *
 * After the adapter publish, the rewire is:
 *   import { MnemonicaExceptionFilter as TraceExceptionFilter } from '@mnemonica/nestjs';
 * and this file deletes. The adapter filter keeps the [unblind] stdout
 * prefix and the nest.caught-exception span name, so the RUNBOOK greps
 * and the Jaeger demo survive unchanged.
 *
 * The Unblinder (2026-09-03, Viktor): teaches Nest's error boundary to
 * speak trace instead of serving the blind default
 * {"statusCode":500,"message":"Internal server error"}.
 *
 * Applied per-route (@UseFilters on /chaos/unblinding and
 * /chaos/corner_cut) so the demo keeps both sides: blindspot stays
 * blind, the taught routes answer with the dive branch, the errored
 * construction edge, the attempted constructor args (core's getProps off
 * the errored instance — the caught error IS that instance) and the
 * actual error — plus an OTel span carrying the exception, so the
 * failure exists in Jaeger too (the process.* spans only cover
 * process-level crashes; a Nest-caught business error previously left NO
 * trace mark at all).
 *
 * Discipline:
 *  - expected client errors (HttpException, validation 400s) keep Nest's
 *    own answer — the trace treatment is for genuine failures only;
 *  - telemetry is UNCONDITIONAL, the body is CONDITIONAL: when the
 *    handler already poisoned the response (partial write — corner_cut's
 *    'headers' flavor), the client's misleading status line cannot be
 *    undone, but stdout, Jaeger and the Live Trace still get everything;
 *  - non-Error throws (corner_cut's 'circular' flavor) are reported
 *    truthfully as such, never dressed up as Errors.
 */
@Catch()
export class TraceExceptionFilter implements ExceptionFilter {
	catch (error: Error, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const res = ctx.getResponse<Response>();

		// Expected client errors keep Nest's own answer.
		if (error instanceof HttpException) {
			const status = error.getStatus();
			const body = error.getResponse();
			res.status(status).json(body);
			return;
		}

		const isError = error instanceof Error;
		const message = isError ? error.message : `non-Error thrown (${typeof error})`;
		const flow = isError ? getFlow(error) : [];
		// The errored create edge attributes the construction's PARENT
		// instance (probed 2026-09-03: edge.instance === existentInstance).
		// The attempted constructor ARGS ride the caught error itself — it
		// IS the errored shell, and getProps exposes its args (see
		// erroredArgsSafe above).
		const erroredEdge = [...flow].reverse().find((edge) => edge.kind === 'create' && edge.status === 'error');
		const erroredInstance = erroredEdge?.instance;
		const attemptedArgs = isError ? erroredArgsSafe(error) : undefined;
		const report = {
			kind            : 'nest-caught-unblinded',
			message,
			branch          : flow.map((edge) => `${edge.kind}:${edge.name}`),
			erroredType     : erroredEdge?.name ?? null,
			erroredInstance : erroredInstance ? extractSafe(erroredInstance) : null,
			attemptedArgs   : attemptedArgs ?? null,
		};

		// Jaeger: an ERROR span with the recorded exception + the dive
		// branch — inside the request's async context, so the ALS context
		// manager parents it under the request span on its own. A non-Error
		// throw is recorded as an attribute: recordException on a circular
		// object could break exporter serialization.
		const span = trace.getTracer('tactica-nestjs').startSpan('nest.caught-exception');
		span.setAttribute('dive.branch', report.branch.join(' → '));
		if (report.erroredType) {
			span.setAttribute('mnemonica.errored_type', report.erroredType);
		}
		span.setStatus({ code: SpanStatusCode.ERROR, message });
		if (isError) {
			span.recordException(error);
		} else {
			span.setAttribute('exception.type', 'non-Error-throw');
		}
		span.end();

		console.log(`[unblind] ${stringifySafe(report)}`);

		// Telemetry unconditional, body conditional: a handler that already
		// wrote a partial answer (headers sent) keeps its misleading status
		// line — nothing can uncommit it — but the trace above still lands.
		if (!res.headersSent) {
			res.status(500).json(report);
			return;
		}
		res.end();
	}
}
