import {
	Controller,
	Post,
	Body,
	Get,
	Param,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
} from '@nestjs/swagger';
import {
	CreateRootAsyncDto,
	ResultFromDecorateResponseDto,
	CreateSyncBaseDto,
	CreateSubAsyncDto,
	SubAsyncResponseDto,
	SubDecorateResponseDto,
	SyncBaseResponseDto,
	RootAsyncResponseDto,
} from './dto/async.dto';

import { lookupTyped } from 'mnemonica';

const RootAsync = lookupTyped('RootAsync');
const SyncBase = lookupTyped('SyncBase');

/**
 * AsyncController demonstrates mnemonica async/await patterns
 *
 * Pattern 1: await new RootAsync -> rootAsync.ResultFromDecorate
 * Pattern 2: await new Sync.SubAsync -> combinedAsync.SubDecorate
 */
@ApiTags('async-examples')
@Controller('async')
export class AsyncController {

	// ============================================================================
	// Pattern 1: RootAsync with ResultFromDecorate
	// ============================================================================

	@Post('root-async')
	@ApiOperation({
		summary: 'Create RootAsync instance',
		description: 'Demonstrates await new RootAsync() - async constructor with 100ms sleep',
	})
	@ApiResponse({
		status: 201,
		description: 'RootAsync instance created',
		type: RootAsyncResponseDto,
	})
	async createRootAsync(@Body() dto: CreateRootAsyncDto): Promise<RootAsyncResponseDto> {
		const rootAsync = await new RootAsync({ value: dto.value });

		const result: RootAsyncResponseDto = {
			value: rootAsync.value,
			computed: rootAsync.computed,
		};

		return result;
	}

	@Post('root-async/result-decorate')
	@ApiOperation({
		summary: 'Create RootAsync then ResultFromDecorate',
		description: 'Demonstrates await new RootAsync() then .ResultFromDecorate() chaining',
	})
	@ApiResponse({
		status: 201,
		description: 'ResultFromDecorate instance created',
		type: ResultFromDecorateResponseDto,
	})
	async createResultFromDecorate(@Body() dto: CreateRootAsyncDto): Promise<ResultFromDecorateResponseDto> {
		const rootAsync = await new RootAsync({ value: dto.value });
		const resultDecorate = await new rootAsync.ResultFromDecorate(dto.multiplier);

		const result: ResultFromDecorateResponseDto = {
			value: resultDecorate.value,
			computed: resultDecorate.computed,
			result: resultDecorate.result,
			timestamp: resultDecorate.timestamp,
		};

		return result;
	}

	@Get('root-async/:value/result-decorate/:multiplier')
	@ApiOperation({
		summary: 'Get ResultFromDecorate via URL params',
		description: 'Alternative GET endpoint for Pattern 1',
	})
	@ApiParam({ name: 'value', type: Number, description: 'Initial value' })
	@ApiParam({ name: 'multiplier', type: Number, description: 'Multiplier for result' })
	@ApiResponse({
		status: 200,
		description: 'Combined result',
		type: ResultFromDecorateResponseDto,
	})
	async getResultFromDecorate(
		@Param('value') value: string,
		@Param('multiplier') multiplier: string,
	): Promise<ResultFromDecorateResponseDto> {
		const rootAsync = await new RootAsync({ value: parseInt(value, 10) });
		const resultDecorate = await new rootAsync.ResultFromDecorate(parseInt(multiplier, 10));

		const result: ResultFromDecorateResponseDto = {
			value: resultDecorate.value,
			computed: resultDecorate.computed,
			result: resultDecorate.result,
			timestamp: resultDecorate.timestamp,
		};

		return result;
	}

	// ============================================================================
	// Pattern 2: SyncBase -> SubAsync -> SubDecorate (pure define chain)
	// ============================================================================

	@Post('sync-base')
	@ApiOperation({
		summary: 'Create SyncBase instance',
		description: 'Creates a SyncBase using define with a class constructor',
	})
	@ApiResponse({
		status: 201,
		description: 'SyncBase instance created',
		type: SyncBaseResponseDto,
	})
	createSyncBase(@Body() dto: CreateSyncBaseDto): SyncBaseResponseDto {
		const syncBase = new SyncBase({ baseValue: dto.baseValue });

		const result: SyncBaseResponseDto = {
			baseValue: syncBase.baseValue,
		};

		return result;
	}

	@Post('sync-base/sub-async')
	@ApiOperation({
		summary: 'Create Sync then SubAsync',
		description: 'Demonstrates await new Sync().SubAsync() chaining',
	})
	@ApiResponse({
		status: 201,
		description: 'SubAsync instance created',
		type: SubAsyncResponseDto,
	})
	async createSubAsync(@Body() dto: CreateSubAsyncDto): Promise<SubAsyncResponseDto> {
		const syncBase = new SyncBase({ baseValue: dto.baseValue });
		const subAsync = await new syncBase.SubAsync({ delay: dto.delay, extra: dto.extra });

		const result: SubAsyncResponseDto = {
			baseValue: subAsync.baseValue,
			delay: subAsync.delay,
			extra: subAsync.extra,
			processed: subAsync.processed,
		};

		return result;
	}

	@Post('sync-base/sub-async/sub-decorate')
	@ApiOperation({
		summary: 'Create full chain: Sync -> SubAsync -> SubDecorate',
		description: 'Demonstrates await new Sync().SubAsync() then access .SubDecorate()',
	})
	@ApiResponse({
		status: 201,
		description: 'SubDecorate instance created',
		type: SubDecorateResponseDto,
	})
	async createSubDecorate(@Body() dto: CreateSubAsyncDto): Promise<SubDecorateResponseDto> {
		const syncBase = new SyncBase({ baseValue: dto.baseValue });
		const subAsync = await new syncBase.SubAsync({
			delay: dto.delay,
			extra: dto.extra,
		});
		const subDecorate = await new subAsync.SubDecorate(dto.decorateValue);

		const result: SubDecorateResponseDto = {
			baseValue: subDecorate.baseValue,
			delay: subDecorate.delay,
			extra: subDecorate.extra,
			processed: subDecorate.processed,
			decorateValue: subDecorate.decorateValue,
			combined: subDecorate.combined,
		};

		return result;
	}

	@Get('sync-base/:baseValue/sub-async/:delay/:extra/sub-decorate/:decorateValue')
	@ApiOperation({
		summary: 'Get full chain via URL params',
		description: 'Alternative GET endpoint for Pattern 2',
	})
	@ApiParam({ name: 'baseValue', type: String, description: 'Base value' })
	@ApiParam({ name: 'delay', type: Number, description: 'Delay in ms' })
	@ApiParam({ name: 'extra', type: String, description: 'Extra string' })
	@ApiParam({ name: 'decorateValue', type: String, description: 'Decoration value' })
	@ApiResponse({
		status: 200,
		description: 'Combined result',
		type: SubDecorateResponseDto,
	})
	async getSubDecorate(
		@Param('baseValue') baseValue: string,
		@Param('delay') delay: string,
		@Param('extra') extra: string,
		@Param('decorateValue') decorateValue: string,
	): Promise<SubDecorateResponseDto> {
		const syncBase = new SyncBase({ baseValue });
		const subAsync = await new syncBase.SubAsync({
			delay: parseInt(delay, 10),
			extra,
		});
		const subDecorate = await new subAsync.SubDecorate(decorateValue);

		const result: SubDecorateResponseDto = {
			baseValue: subDecorate.baseValue,
			delay: subDecorate.delay,
			extra: subDecorate.extra,
			processed: subDecorate.processed,
			decorateValue: subDecorate.decorateValue,
			combined: subDecorate.combined,
		};

		return result;
	}
}
