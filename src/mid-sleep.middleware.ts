import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { wrap } from '@mnemonica/dive';
import type { UserEntity_UserResponse } from '../.tactica/types';

/**
 * The payload the /chaos/mid_sleep handler stashes on the request AFTER
 * the middleware already ran: the middleware's timer fires at 100ms, the
 * handler sleeps 1000ms, so by fire time the instances exist.
 */
export type midSleepStash = {
	id           : string;
	mark         : string;
	userResponse : UserEntity_UserResponse;
};

type stashedRequest = Request & { chaosMidSleep?: midSleepStash };

const THROW_AFTER_MS = 100;

/**
 * Mid-sleep assassin (2026-09-02, Viktor's "armored shoes" demo).
 *
 * The bad pattern JS devs write every day: a MIDDLEWARE establishes a
 * timer, the handler is still sleeping when it fires, and the timer
 * throws — shooting the whole process in the shoe. The armor: main.ts
 * keeps an uncaughtException listener (process survives), and dive wraps
 * the throw with the request's instance as context — so the crash report
 * connects through the instance's CONSTRUCTION chain (ancestors:
 * create:UserEntity → create:UserResponse), not through wrap predecessors
 * (the timer's fiber never ran any wrapped call before this one).
 *
 * The wrap can only happen AT FIRE TIME: when the middleware runs, the
 * handler has not created any instance yet — the payload is stashed on
 * the request and read back when the timer fires.
 */
@Injectable()
export class MidSleepMiddleware implements NestMiddleware {
	use (req: stashedRequest, _res: Response, next: NextFunction): void {
		// Deliberately NOT unref'd: the timer must outlive nothing but the
		// first 100ms of the request's 1000ms sleep.
		setTimeout(() => {
			const stash = req.chaosMidSleep;
			if (!stash) {
				// The handler never stashed (route misconfiguration) — an
				// uncontexted throw here would only pollute the demo.
				console.warn('[mid-sleep] timer fired with no payload stashed — skipping');
				return;
			}
			// mark stays the LAST ':'-separated segment (park-key parsing
			// in main.ts); nothing is parked for this endpoint, so the
			// crash line stays answered=false — the request SURVIVES.
			const grenade = wrap(() => {
				throw new Error(`chaos-mid-sleep:${stash.id}:${stash.mark}`);
			}, stash.userResponse, 'chaos:mid-sleep-timer');
			grenade();
		}, THROW_AFTER_MS);
		next();
	}
}
