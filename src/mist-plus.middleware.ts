import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { produceMessage } from './fake-queue';

const PRODUCE_AFTER_MS = 100;

type queuedRequest = Request & { mistPlusQueueKey?: string };

/**
 * mist_plus producer (2026-09-02, Viktor's queue demo).
 *
 * Same assassin shape as mid-sleep — a MIDDLEWARE-established timer —
 * but instead of throwing, the timer answers the request's queue message:
 * "the remote service replied". The reply deliberately FAILS the sanity
 * marker (sane: false), so the handler's business rules demand a throw —
 * and crafting the error response dies inside the UserResponse
 * constructor (see entities/user.entity.ts). The minted queue key is
 * stashed on the request for the handler to consume with. Serves both
 * sides of the boundary demo: /chaos/blindspot and /chaos/unblinding.
 */
@Injectable()
export class MistPlusMiddleware implements NestMiddleware {
	use (req: queuedRequest, _res: Response, next: NextFunction): void {
		const queueKey = crypto.randomUUID();
		req.mistPlusQueueKey = queueKey;
		// Deliberately NOT unref'd: it must fire during the handler's await.
		setTimeout(() => {
			const detail = `remote-sanity-failed:${queueKey.split('-')[0]}`;
			produceMessage(queueKey, { sane: false, detail });
		}, PRODUCE_AFTER_MS);
		next();
	}
}
