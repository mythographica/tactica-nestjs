import { IsString, IsEmail, IsUUID, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base User DTO - standard NestJS DTO with class-validator
 * Used for API input validation
 */
export class CreateUserDto {
	@ApiProperty({
		description: 'User email address',
		example: 'user@example.com',
	})
	@IsEmail()
	email!: string;

	@ApiProperty({
		description: 'User name',
		example: 'John Doe',
	})
	@IsString()
	name!: string;
}

/**
 * Admin DTO extends User with additional fields
 */
export class CreateAdminDto extends CreateUserDto {
	@ApiProperty({
		description: 'Admin role',
		example: 'admin',
	})
	@IsString()
	role!: string;

	@ApiPropertyOptional({
		description: 'List of permissions',
		example: ['read', 'write', 'delete'],
		type: [String],
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	permissions?: string[];
}

/**
 * SuperAdmin DTO extends Admin
 */
export class CreateSuperAdminDto extends CreateAdminDto {
	@ApiProperty({
		description: 'Domain this superadmin manages',
		example: 'global',
	})
	@IsString()
	domain!: string;
}

/**
 * Response DTOs
 */
export class UserResponseDto {
	@ApiProperty({
		description: 'Unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	id!: string;

	@ApiProperty({
		description: 'User email address',
		example: 'user@example.com',
	})
	@IsEmail()
	email!: string;

	@ApiProperty({
		description: 'User name',
		example: 'John Doe',
	})
	@IsString()
	name!: string;

	@ApiProperty({
		description: 'Entity type',
		example: 'user',
		enum: ['user', 'admin', 'superadmin'],
	})
	@IsString()
	type!: string;
}

export class AdminResponseDto extends UserResponseDto {
	@ApiProperty({
		description: 'Admin role',
		example: 'admin',
	})
	@IsString()
	role!: string;

	@ApiProperty({
		description: 'List of permissions',
		example: ['read', 'write', 'delete'],
		type: [String],
	})
	@IsArray()
	@IsString({ each: true })
	permissions!: string[];
}

export class SuperAdminResponseDto extends AdminResponseDto {
	@ApiProperty({
		description: 'Domain this superadmin manages',
		example: 'global',
	})
	@IsString()
	domain!: string;
}
