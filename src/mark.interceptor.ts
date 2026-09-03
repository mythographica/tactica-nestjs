import { Injectable } from '@nestjs/common';
import type { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';

/**
 * Demo interceptor: stamps a second random token (`imark`) onto the
 * request so the /chaos/crash_int_response demo can show the full
 * correlation table —
 *   watcher mark (body)  →  interceptor imark  →  crash report payload.
 *
 * Fixture-local on purpose: this demo lives in tactica-nestjs, NOT in the
 * published @mnemonica/nestjs adapter (avoids a publish cycle). Only
 * stamps when absent, so a watcher can supply their own via the
 * x-imark header.
 */
@Injectable()
export class MarkInterceptor implements NestInterceptor {
	intercept (context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const req = context.switchToHttp().getRequest<Request & { imark?: string }>();
		const stamped = req.headers['x-imark'];
		if (typeof stamped === 'string' && stamped.length > 0) {
			req.imark = stamped;
		} else {
			req.imark = crypto.randomUUID().split('-')[0];
		}
		const result = next.handle();
		return result;
	}
}
