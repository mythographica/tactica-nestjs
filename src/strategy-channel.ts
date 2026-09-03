import { startStrategyClient } from '@mnemonica/strategy';
import type { StrategyClientHandle } from '@mnemonica/strategy';

/**
 * Self-hosted Strategy WS construction/trace channel (Strategy reframe,
 * 2026-09-01).
 *
 * The app hosts the channel itself — no --inspect, no CDP injection.
 * Env-gated: set STRATEGY_CLIENT=1 (ephemeral port) or
 * STRATEGY_CLIENT_PORT=<n> (pinned). Discovery: GET /strategy/channel
 * reports { available, port, token, pid } so a monitor (Mnemographica)
 * can connect directly with WSSession + traceSubscribe.
 *
 * DEV ONLY: the discovery endpoint exposes the channel token over plain
 * HTTP. Loopback development fixture — never enable on a shared stand.
 */

declare global {
	// eslint-disable-next-line no-var
	var __strategyChannel: {
		port: number;
		token: string;
		pid: number;
		startedAt: number;
	} | undefined;
}

let handle: StrategyClientHandle | null = null;

export async function bootstrapStrategyChannel (): Promise<void> {
	const enabled = process.env.STRATEGY_CLIENT === '1' || !!process.env.STRATEGY_CLIENT_PORT;
	if (!enabled) {
		return;
	}
	const port = Number(process.env.STRATEGY_CLIENT_PORT) || 0;
	handle = await startStrategyClient({ port });
	globalThis.__strategyChannel = {
		port      : handle.port,
		token     : handle.token,
		pid       : handle.pid,
		startedAt : Date.now(),
	};
	console.log(`[strategy] WS channel self-hosted on 127.0.0.1:${handle.port} (GET /strategy/channel for the token)`);
}

export async function stopStrategyChannel (): Promise<void> {
	if (handle) {
		await handle.stop();
		handle = null;
	}
	globalThis.__strategyChannel = undefined;
}
