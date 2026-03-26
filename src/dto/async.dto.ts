import { ApiProperty } from '@nestjs/swagger';

// =============================================================================
// DTOs for Pattern 1: RootAsync with ResultFromDecorate
// =============================================================================

export class CreateRootAsyncDto {
	@ApiProperty({
		description: 'Input value to process',
		example: 42,
	})
	value: number = 0;

	@ApiProperty({
		description: 'Multiplier for ResultFromDecorate',
		example: 3,
	})
	multiplier: number = 1;
}

export class RootAsyncResponseDto {
	@ApiProperty({
		description: 'Original value',
		example: 42,
	})
	value: number = 0;

	@ApiProperty({
		description: 'Computed value (value * 2)',
		example: 84,
	})
	computed: number = 0;
}

export class ResultFromDecorateResponseDto extends RootAsyncResponseDto {
	@ApiProperty({
		description: 'Final result (computed * multiplier)',
		example: 252,
	})
	result: number = 0;

	@ApiProperty({
		description: 'Timestamp when result was created',
		example: 1700000000000,
	})
	timestamp: number = 0;
}

// =============================================================================
// DTOs for Pattern 2: Sync Base with SubAsync and SubDecorate
// =============================================================================

export class CreateSyncBaseDto {
	@ApiProperty({
		description: 'Base value for the sync type',
		example: 'hello',
	})
	baseValue: string = '';
}

export class CreateSubAsyncDto {
	@ApiProperty({
		description: 'Base value for the sync type',
		example: 'hello',
	})
	baseValue: string = '';

	@ApiProperty({
		description: 'Delay in milliseconds (simulates async operation)',
		example: 100,
	})
	delay: number = 100;

	@ApiProperty({
		description: 'Extra string to append',
		example: 'world',
	})
	extra: string = '';

	@ApiProperty({
		description: 'Decoration value for SubDecorate',
		example: 'decorated',
	})
	decorateValue: string = '';
}

export class SyncBaseResponseDto {
	@ApiProperty({
		description: 'Base value',
		example: 'hello',
	})
	baseValue: string = '';
}

export class SubAsyncResponseDto extends SyncBaseResponseDto {
	@ApiProperty({
		description: 'Delay used',
		example: 100,
	})
	delay: number = 0;

	@ApiProperty({
		description: 'Extra string appended',
		example: 'world',
	})
	extra: string = '';

	@ApiProperty({
		description: 'Processed value (baseValue-extra)',
		example: 'hello-world',
	})
	processed: string = '';
}

export class SubDecorateResponseDto extends SubAsyncResponseDto {
	@ApiProperty({
		description: 'Decoration value',
		example: 'decorated',
	})
	decorateValue: string = '';

	@ApiProperty({
		description: 'Combined result (processed:decorateValue)',
		example: 'hello-world:decorated',
	})
	combined: string = '';
}
