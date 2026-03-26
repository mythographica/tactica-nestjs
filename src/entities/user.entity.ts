import { define } from 'mnemonica';
import type {
	UserEntity,
	UserEntity_UserResponse,
	UserEntity_AdminEntity,
	UserEntity_AdminEntity_AdminResponse,
	UserEntity_AdminEntity_SuperAdminEntity,
	UserEntity_AdminEntity_SuperAdminEntity_SuperAdminResponse,
} from '../../.tactica/types';

/**
 * User Entity defined with mnemonica
 * Using define() for runtime inheritance
 */
const User = define('UserEntity', function (this: UserEntity, data: { id: string; email: string; name: string }) {
	this.id = data.id;
	this.email = data.email;
	this.name = data.name;
})

/**
 * UserResponse - nested type for API responses
 * Demonstrates mnemonica's hierarchical type system
 * This is a sub-type of UserEntity, accessible as user.UserResponse
 */
.define('UserResponse', function (
	this: UserEntity_UserResponse,
	data: { id: string; email: string; name: string; type: 'user' }
) {
	this.id = data.id;
	this.email = data.email;
	this.name = data.name;
	this.type = data.type;
});

/**
 * Admin Entity extending User
 * This is a sub-type of UserEntity, accessible as user.AdminEntity
 */
const Admin = User.define('AdminEntity', function (this: UserEntity_AdminEntity, data: { id: string; email: string; name: string; role: string; permissions: string[] }) {
	this.id = data.id;
	this.email = data.email;
	this.name = data.name;
	this.role = data.role;
	this.permissions = data.permissions || [];
});

/**
 * AdminResponse - nested type extending AdminEntity hierarchy
 * Demonstrates nested sub-type at second level
 * Accessible as admin.AdminResponse
 */
Admin.define('AdminEntityAdminResponse', function (
	this: UserEntity_AdminEntity_AdminResponse,
	data: { id: string; email: string; name: string; type: 'admin'; role: string; permissions: string[] }
) {
	this.id = data.id;
	this.email = data.email;
	this.name = data.name;
	this.type = data.type;
	this.role = data.role;
	this.permissions = data.permissions;
});

/**
 * SuperAdmin Entity extending Admin
 * Three-level inheritance hierarchy
 * This is a sub-type of AdminEntity, accessible as admin.SuperAdminEntity
 */
const SuperAdmin = Admin.define('SuperAdminEntity', function (this: UserEntity_AdminEntity_SuperAdminEntity, data: { id: string; email: string; name: string; role: string; permissions: string[]; domain: string }) {
	this.id = data.id;
	this.email = data.email;
	this.name = data.name;
	this.role = data.role;
	this.permissions = data.permissions || [];
	this.domain = data.domain;
});

/**
 * SuperAdminResponse - nested type at the top of hierarchy
 * Demonstrates three-level nested type inheritance
 * Accessible as superAdmin.SuperAdminResponse
 */
SuperAdmin.define('SuperAdminResponse', function (
	this: UserEntity_AdminEntity_SuperAdminEntity_SuperAdminResponse,
	data: { id: string; email: string; name: string; type: 'superadmin'; role: string; permissions: string[]; domain: string }
) {
	this.id = data.id;
	this.email = data.email;
	this.name = data.name;
	this.type = data.type;
	this.role = data.role;
	this.permissions = data.permissions;
	this.domain = data.domain;
});
