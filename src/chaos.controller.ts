import {
	Controller,
	Get,
	Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { lookup } from 'mnemonica';
import { wrap } from '@mnemonica/dive';

const UserEntity = lookup('UserEntity');

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
 */
@ApiTags('chaos')
@Controller('chaos')
export class ChaosController {

	@Get('ok')
	@ApiOperation({
		summary: 'Control endpoint',
		description: 'Normal wrapped path with an instance creation — for sustained load',
	})
	@ApiResponse({ status: 200, description: 'Control path executed' })
	ok (): { status: string; id: string } {
		const worker = wrap((id: string) => {
			const user = new UserEntity({
				id,
				email: `${id}@chaos.local`,
				name: `chaos-${id}`,
			});
			const result = user.constructor.name;
			return result;
		}, 'chaos:ok');

		const id = crypto.randomUUID();
		const typeName = worker(id);
		const result = { status: 'ok', id, typeName };
		return result;
	}

	@Post('crash')
	@ApiOperation({
		summary: 'Trigger a real uncaughtException',
		description: 'Schedules a wrapped throw on the next tick — escapes Nest exception filters',
	})
	@ApiResponse({ status: 201, description: 'Crash scheduled' })
	crash (): { status: string; id: string } {
		const id = crypto.randomUUID();
		const user = new UserEntity({
			id,
			email: `${id}@chaos.local`,
			name: `chaos-${id}`,
		});

		// The throw happens OUTSIDE the request/response cycle, in a wrapped
		// callback whose execution parent is the instance above — so dive
		// pins the error to this branch before it reaches the process.
		const grenade = wrap(() => {
			throw new Error(`chaos-crash:${id}`);
		}, user, 'chaos:crash');

		setImmediate(grenade);

		const result = { status: 'crash-scheduled', id };
		return result;
	}

	@Post('reject')
	@ApiOperation({
		summary: 'Trigger a real unhandledRejection',
		description: 'Returns a dangling rejected promise from a wrapped callback',
	})
	@ApiResponse({ status: 201, description: 'Rejection scheduled' })
	reject (): { status: string; id: string } {
		const id = crypto.randomUUID();
		const user = new UserEntity({
			id,
			email: `${id}@chaos.local`,
			name: `chaos-${id}`,
		});

		const grenade = wrap(() => {
			const result = Promise.reject(new Error(`chaos-reject:${id}`));
			return result;
		}, user, 'chaos:reject');

		// Deliberately NOT awaited/caught — the rejection stays dangling.
		setImmediate(grenade);

		const result = { status: 'reject-scheduled', id };
		return result;
	}
}
