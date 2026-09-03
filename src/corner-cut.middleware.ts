import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { submitTask } from './fake-queue';

/**
 * Corner-cut producer (2026-09-03, Viktor's lazybones demo).
 *
 * The everyday shortcut: fire a task into the queue, FORGET it, and
 * stash the task id on the request itself — bypassing every piece of
 * machinery (no DI, no context, no types) because "the route handler
 * can just read it off req". The flavor rides the untyped body, exactly
 * the way such code passes switches around.
 */
@Injectable()
export class CornerCutMiddleware implements NestMiddleware {
	use (req: Request, _res: Response, next: NextFunction): void {
		const taskId = crypto.randomUUID();
		const body = (req as Request & { body?: { flavor?: unknown } }).body;
		const flavor = body && body.flavor === 'circular'
			? 'circular'
			: body && body.flavor === 'headers'
				? 'headers'
				: 'typeerror';
		// Fire-and-forget: the queue owns the task from here.
		submitTask(taskId, flavor);
		// The corner cut itself: an untyped attachment on the request.
		(req as Request & { taskId?: unknown }).taskId = taskId;
		next();
	}
}
