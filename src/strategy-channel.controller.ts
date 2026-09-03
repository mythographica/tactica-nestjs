import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Discovery for the self-hosted Strategy WS channel (see
 * strategy-channel.ts). DEV ONLY — this exposes the session token over
 * plain HTTP so local tooling (Mnemographica) can connect without CDP.
 */
@ApiTags('strategy')
@Controller('strategy')
export class StrategyChannelController {

	@Get('channel')
	@ApiOperation({
		summary     : 'Strategy WS channel discovery',
		description : 'Reports { available, port, token, pid } of the self-hosted strategy channel (enabled via STRATEGY_CLIENT / STRATEGY_CLIENT_PORT env)',
	})
	@ApiResponse({ status: 200, description: 'Channel discovery info' })
	channel (): { available: boolean; port?: number; token?: string; pid?: number } {
		const channel = globalThis.__strategyChannel;
		if (!channel) {
			const unavailable = { available: false };
			return unavailable;
		}
		const result = {
			available : true,
			port      : channel.port,
			token     : channel.token,
			pid       : channel.pid,
		};
		return result;
	}
}
