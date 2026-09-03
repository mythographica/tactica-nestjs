import type { Response } from 'express';

/**
 * Crash-response parking lot (2026-09-02, Viktor's demo design).
 *
 * The other chaos endpoints escape the request/response cycle ON PURPOSE:
 * the grenade fires on a later tick, Nest's exception filters never see
 * it, and the default outcome is "201 answered early, then the process
 * handler only logs". The /chaos/crash_*_response endpoints instead PARK
 * the raw response here (@Res without passthrough) and await a gate; the
 * process-level uncaughtException/unhandledRejection handler in main.ts
 * resolves the gate by mark, answering the parked socket with HTTP 500 +
 * the full crash report. That is the demo proof: an escaped process-level
 * failure CAN be joined back to its own request's response.
 *
 * Keyed by mark. Duplicate caller-supplied marks collide — last wins and
 * the earlier entry times out. Acceptable for a demo fixture.
 */

type parkedCrash = {
	res     : Response;
	resolve : () => void;
	timer   : NodeJS.Timeout;
};

const parked = new Map<string, parkedCrash>();

const PARK_TIMEOUT_MS = 10_000;

export function parkCrash (mark: string, res: Response): Promise<void> {
	const result = new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			parked.delete(mark);
			// The grenade never fired (or its report lost the mark): answer
			// anyway rather than hang the socket forever.
			res.status(500).json({
				error : 'crash-park-timeout',
				mark,
				note  : `no process-level crash arrived within ${PARK_TIMEOUT_MS}ms`,
			});
			resolve();
		}, PARK_TIMEOUT_MS);
		parked.set(mark, { res, resolve, timer });
	});
	return result;
}

/**
 * Called synchronously from the process-level error handler. Answers the
 * parked response (500 + report) and releases the controller's gate.
 * Returns false when nothing was parked under this mark.
 */
export function resolveCrash (mark: string, report: unknown): boolean {
	const entry = parked.get(mark);
	if (!entry) {
		const result = false;
		return result;
	}
	parked.delete(mark);
	clearTimeout(entry.timer);
	entry.res.status(500).json(report);
	entry.resolve();
	const result = true;
	return result;
}
