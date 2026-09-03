/**
 * Fake message queue (2026-09-02, mist_plus demo).
 *
 * Emulates the Kafka request-reply pattern without any infrastructure:
 * the middleware's timer PRODUCES a message ~100ms after the request
 * arrived ("the remote service answered"), the route handler CONSUMES it
 * with an await ("we sent something to kafka and await the reply").
 * Keyed per-request; the buffered path covers a produce that beats the
 * consume registration.
 */

export type queueMessage = {
	sane   : boolean;
	detail : string;
};

const waiters = new Map<string, (message: queueMessage) => void>();
const buffered = new Map<string, queueMessage>();

export function produceMessage (key: string, message: queueMessage): void {
	const waiter = waiters.get(key);
	if (waiter) {
		waiters.delete(key);
		waiter(message);
		return;
	}
	buffered.set(key, message);
}

export function consumeMessage (key: string): Promise<queueMessage> {
	const early = buffered.get(key);
	if (early) {
		buffered.delete(key);
		const result = Promise.resolve(early);
		return result;
	}
	const result = new Promise<queueMessage>((resolve) => {
		waiters.set(key, resolve);
	});
	return result;
}

/**
 * Task side of the fake queue (2026-09-03, corner_cut demo).
 *
 * submitTask is FIRE-AND-FORGET: the caller gets nothing but the id it
 * already had — the queue owns execution (its internal worker timer) and
 * completes the task ~100ms later. awaitTask is the shortened outbox:
 * the route handler awaits the payload by id. The result is deliberately
 * typed unknown at the boundary — real corner-cutters type it `any`.
 *
 * The worker produces MALFORMED payloads (that is the demo): 'typeerror'
 * gets a well-formed envelope whose result fields are simply absent;
 * 'circular' gets a self-referencing object — the classic non-Error
 * throwbait.
 */

const WORK_AFTER_MS = 100;

const taskResults = new Map<string, unknown>();
const taskWaiters = new Map<string, (result: unknown) => void>();

function makeCircular (): Record<string, unknown> {
	const result: Record<string, unknown> = { status: 'ok', note: 'self-referencing payload' };
	result.self = result;
	return result;
}

export function submitTask (taskId: string, flavor: string): void {
	// Deliberately NOT unref'd: it must fire while the handler awaits.
	setTimeout(() => {
		const result = flavor === 'circular'
			? makeCircular()
			: { status: 'ok', result: null };
		const waiter = taskWaiters.get(taskId);
		if (waiter) {
			taskWaiters.delete(taskId);
			waiter(result);
			return;
		}
		taskResults.set(taskId, result);
	}, WORK_AFTER_MS);
}

export function awaitTask (taskId: string): Promise<unknown> {
	const early = taskResults.get(taskId);
	if (early !== undefined || taskResults.has(taskId)) {
		taskResults.delete(taskId);
		const result = Promise.resolve(early);
		return result;
	}
	const result = new Promise<unknown>((resolve) => {
		taskWaiters.set(taskId, resolve);
	});
	return result;
}
