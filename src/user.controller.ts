import {
	Controller,
	Get,
	Post,
	Body,
	Param,
	ValidationPipe,
	UsePipes,
	Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { UserService } from './user.service';
import {
	CreateUserDto,
	CreateAdminDto,
	CreateSuperAdminDto,
} from './dto/user.dto';

import { lookupTyped } from 'mnemonica';

const UserEntity = lookupTyped('UserEntity');

import type {
	UserEntity,
	UserEntity_UserResponse,
	UserEntity_AdminEntity_AdminResponse,
	UserEntity_AdminEntity_SuperAdminEntity_SuperAdminResponse
} from '../.tactica/types';

/**
 * User Controller with Swagger documentation
 * Demonstrates standard NestJS DTO validation with mnemonica entities
 */
@ApiTags('users')
@Controller('users')
export class UserController {
	private readonly logger = new Logger(UserController.name);

	constructor (private readonly userService: UserService) {}

	@Post()
	@ApiOperation({
		summary: 'Create a new user',
		description: 'Creates a user entity using mnemonica',
	})
	@ApiBody({ type: CreateUserDto })
	@ApiResponse({ status: 201, description: 'User created successfully', type: CreateUserDto })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@UsePipes(new ValidationPipe({ transform: true }))
	createUser (@Body() createUserDto: CreateUserDto): UserEntity_UserResponse {
		this.logger.log('=== Creating User Entity ===');
		this.logger.log(`Input data: ${JSON.stringify(createUserDto)}`);

		// Create user entity using mnemonica
		const user = new UserEntity({
			id: crypto.randomUUID(),
			email: createUserDto.email,
			name: createUserDto.name,
		});
		this.logger.log(`Created UserEntity: ${user.constructor.name}`);

		const userResult = this.userService.createUser(user);
		return userResult;
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get user by ID', description: 'Retrieves a user by their unique identifier' })
	@ApiParam({ name: 'id', description: 'User UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiResponse({ status: 200, description: 'User found', type: CreateUserDto })
	@ApiResponse({ status: 404, description: 'User not found' })
	getUser (@Param('id') id: string): UserEntity_UserResponse {
		this.logger.log(`=== Getting User by ID: ${id} ===`);
		const userResult = this.userService.findUser(id);
		return userResult;
	}
}

/**
 * Admin Controller with Swagger documentation
 * Demonstrates mnemonica inheritance: User -> Admin
 */
@ApiTags('admins')
@Controller('admins')
export class AdminController {
	private readonly logger = new Logger(AdminController.name);

	constructor (private readonly userService: UserService) {}

	@Post()
	@ApiOperation({
		summary: 'Create a new admin',
		description: 'Creates an admin using mnemonica inheritance: first creates User, then Admin from User',
	})
	@ApiBody({ type: CreateAdminDto })
	@ApiResponse({ status: 201, description: 'Admin created successfully', type: CreateAdminDto })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@UsePipes(new ValidationPipe({ transform: true }))
	createAdmin (@Body() createAdminDto: CreateAdminDto): UserEntity_AdminEntity_AdminResponse {
		this.logger.log('=== Creating Admin Entity via mnemonica inheritance ===');
		this.logger.log(`Input data: ${JSON.stringify(createAdminDto)}`);

		// Step 1: Create parent UserEntity instance
		const user = new UserEntity({
			id: crypto.randomUUID(),
			email: createAdminDto.email,
			name: createAdminDto.name,
		});
		this.logger.log(`Step 1: Created UserEntity: ${user.constructor.name}`);

		// Step 2: Create AdminEntity from the UserEntity instance
		// This is the proper mnemonica inheritance pattern
		const admin = new user.AdminEntity({
			id: user.id,
			email: user.email,
			name: user.name,
			role: createAdminDto.role,
			permissions: createAdminDto.permissions || [],
		});
		this.logger.log(`Step 2: Created AdminEntity from user: ${admin.constructor.name}`);

		// Verify inheritance
		this.logger.log(`Admin has all inherited properties:`);
		this.logger.log(`  - id (from User): ${'id' in admin}`);
		this.logger.log(`  - email (from User): ${'email' in admin}`);
		this.logger.log(`  - name (from User): ${'name' in admin}`);
		this.logger.log(`  - role (from Admin): ${'role' in admin}`);
		this.logger.log(`  - permissions (from Admin): ${'permissions' in admin}`);

		const adminResult = this.userService.createAdmin(admin);
		return adminResult;
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get admin by ID', description: 'Retrieves an admin by their unique identifier' })
	@ApiParam({ name: 'id', description: 'Admin UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiResponse({ status: 200, description: 'Admin found', type: CreateAdminDto })
	@ApiResponse({ status: 404, description: 'Admin not found' })
	getAdmin (@Param('id') id: string): UserEntity_AdminEntity_AdminResponse {
		this.logger.log(`=== Getting Admin by ID: ${id} ===`);
		const adminResult = this.userService.findAdmin(id);
		return adminResult;
	}
}

/**
 * SuperAdmin Controller with Swagger documentation
 * Demonstrates mnemonica 3-level inheritance: User -> Admin -> SuperAdmin
 */
@ApiTags('super-admins')
@Controller('super-admins')
export class SuperAdminController {
	private readonly logger = new Logger(SuperAdminController.name);

	constructor (private readonly userService: UserService) {}

	@Post()
	@ApiOperation({
		summary: 'Create a new super admin',
		description: 'Creates a superadmin using mnemonica 3-level inheritance: User -> Admin -> SuperAdmin',
	})
	@ApiBody({ type: CreateSuperAdminDto })
	@ApiResponse({ status: 201, description: 'SuperAdmin created successfully', type: CreateSuperAdminDto })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@UsePipes(new ValidationPipe({ transform: true }))
	createSuperAdmin (
		@Body() createSuperAdminDto: CreateSuperAdminDto
	): UserEntity_AdminEntity_SuperAdminEntity_SuperAdminResponse {
		this.logger.log('=== Creating SuperAdmin Entity via mnemonica 3-level inheritance ===');
		this.logger.log(`Input data: ${JSON.stringify(createSuperAdminDto)}`);

		// Step 1: Create parent UserEntity instance
		const user = new UserEntity({
			id: crypto.randomUUID(),
			email: createSuperAdminDto.email,
			name: createSuperAdminDto.name,
		});
		this.logger.log(`Step 1: Created UserEntity: ${user.constructor.name}`);

		// Step 2: Create AdminEntity from the UserEntity instance
		const admin = new user.AdminEntity({
			id: user.id,
			email: user.email,
			name: user.name,
			role: createSuperAdminDto.role,
			permissions: createSuperAdminDto.permissions || [],
		});
		this.logger.log(`Step 2: Created AdminEntity from user: ${admin.constructor.name}`);
		this.logger.log(`Admin has SuperAdminEntity subtype: ${'SuperAdminEntity' in admin}`);

		// Step 3: Create SuperAdminEntity from the AdminEntity instance
		// This completes the 3-level inheritance chain
		const superAdmin = new admin.SuperAdminEntity({
			id: admin.id,
			email: admin.email,
			name: admin.name,
			role: admin.role,
			permissions: admin.permissions,
			domain: createSuperAdminDto.domain,
		});
		this.logger.log(`Step 3: Created SuperAdminEntity from admin: ${superAdmin.constructor.name}`);

		// Verify all 3 levels of inheritance
		this.logger.log(`SuperAdmin has all inherited properties:`);
		this.logger.log(`  - id (from User): ${'id' in superAdmin} = ${superAdmin.id}`);
		this.logger.log(`  - email (from User): ${'email' in superAdmin} = ${superAdmin.email}`);
		this.logger.log(`  - name (from User): ${'name' in superAdmin} = ${superAdmin.name}`);
		this.logger.log(`  - role (from Admin): ${'role' in superAdmin} = ${superAdmin.role}`);
		this.logger.log(`  - permissions (from Admin): ${'permissions' in superAdmin} = ${JSON.stringify(superAdmin.permissions)}`);
		this.logger.log(`  - domain (from SuperAdmin): ${'domain' in superAdmin} = ${superAdmin.domain}`);

		const superAdminResult = this.userService.createSuperAdmin(superAdmin);
		return superAdminResult;
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get super admin by ID', description: 'Retrieves a superadmin by their unique identifier' })
	@ApiParam({ name: 'id', description: 'SuperAdmin UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiResponse({ status: 200, description: 'SuperAdmin found', type: CreateSuperAdminDto })
	@ApiResponse({ status: 404, description: 'SuperAdmin not found' })
	getSuperAdmin (@Param('id') id: string): UserEntity_AdminEntity_SuperAdminEntity_SuperAdminResponse {
		this.logger.log(`=== Getting SuperAdmin by ID: ${id} ===`);
		const superAdminResult = this.userService.findSuperAdmin(id);
		return superAdminResult;
	}
}
