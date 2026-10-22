import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Nested part of CreateWidgetDto — validated through @ValidateNested.
 */
export class WidgetAddressDto {
	@ApiProperty({ example: 'Lisbon' })
	@IsString()
	city!: string;
}

/**
 * Plain class-validator DTO handed to mvp.forType(MvpWidget, CreateWidgetDto)
 */
export class CreateWidgetDto {
	@ApiProperty({ example: 'widget-1' })
	@IsString()
	name!: string;

	@ApiProperty({ type: WidgetAddressDto })
	@ValidateNested()
	@Type(() => WidgetAddressDto)
	addr!: WidgetAddressDto;
}
