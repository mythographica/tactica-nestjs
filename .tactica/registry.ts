// Generated TypeRegistry for type-safe mnemonica.lookupTyped<TypeRegistry>()
// Import this interface and use with lookupTyped from mnemonica
//
// Usage:
//   import { lookupTyped } from 'mnemonica';
//   import { TypeRegistry } from './.tactica/registry';
//   const Sentience = lookupTyped<TypeRegistry>('Sentience');
//   // TypeScript knows: Sentience is a constructor for SentienceInstance
//   const instance = new Sentience({ purpose: 'AI' });
//   // instance has full intellisense for Consciousness, Memory, etc.

import type {
	RootAsync,
	RootAsync_ResultFromDecorate,
	SyncBase,
	SyncBase_SubAsync,
	SyncBase_SubAsync_SubDecorate,
	UserEntity,
	UserEntity_UserResponse,
	UserEntity_AdminEntity,
	UserEntity_AdminEntity_AdminResponse,
	UserEntity_AdminEntity_SuperAdminEntity,
	UserEntity_AdminEntity_SuperAdminEntity_SuperAdminResponse,
	Sentience,
	Sentience_Consciousness,
	Sentience_Consciousness_Curiosity,
	Sentience_Consciousness_Empathy,
	Sentience_Consciousness_Empathy_Gratitude,
	Sentience_Consciousness_Sympathy,
	Sentience_Memory,
} from './types';

/**
 * Type registry augmenting mnemonica's TypeRegistry interface
 * This enables type-safe lookupTyped() without explicit type arguments
 *
 * Usage: const SomeType = lookupTyped('SomeType'); // Fully typed!
 */
declare module 'mnemonica' {
	interface TypeRegistry {
		'RootAsync': new (data: { value: number }) => RootAsync;
		'RootAsync.ResultFromDecorate': new (multiplier: number) => RootAsync_ResultFromDecorate;
		'SyncBase': new (data: { baseValue: string }) => SyncBase;
		'SyncBase.SubAsync': new (asyncData: { delay: number; extra: string }) => SyncBase_SubAsync;
		'SyncBase.SubAsync.SubDecorate': new (decorateValue: string) => SyncBase_SubAsync_SubDecorate;
		'UserEntity': new (data: { id: string; email: string; name: string }) => UserEntity;
		'UserEntity.UserResponse': new (data: { id: string; email: string; name: string; type: 'user' }) => UserEntity_UserResponse;
		'UserEntity.AdminEntity': new (data: { id: string; email: string; name: string; role: string; permissions: Array<string> }) => UserEntity_AdminEntity;
		'UserEntity.AdminEntity.AdminResponse': new (data: { id: string; email: string; name: string; type: 'admin'; role: string; permissions: Array<string> }) => UserEntity_AdminEntity_AdminResponse;
		'UserEntity.AdminEntity.SuperAdminEntity': new (data: { id: string; email: string; name: string; role: string; permissions: Array<string>; domain: string }) => UserEntity_AdminEntity_SuperAdminEntity;
		'UserEntity.AdminEntity.SuperAdminEntity.SuperAdminResponse': new (data: { id: string; email: string; name: string; type: 'superadmin'; role: string; permissions: Array<string>; domain: string }) => UserEntity_AdminEntity_SuperAdminEntity_SuperAdminResponse;
		'Sentience': new (sentience_data: { awareness?: string; identity?: string }) => Sentience;
		'Sentience.Consciousness': new (data: { awarenessLevel?: string; state?: string; focus?: string }) => Sentience_Consciousness;
		'Sentience.Consciousness.Curiosity': new (data: { topic?: string; intensity?: number; message?: string }) => Sentience_Consciousness_Curiosity;
		'Sentience.Consciousness.Empathy': new (data: { target?: string; intensity?: number; message?: string }) => Sentience_Consciousness_Empathy;
		'Sentience.Consciousness.Empathy.Gratitude': new (data: { reason?: string; intensity?: number; message?: string }) => Sentience_Consciousness_Empathy_Gratitude;
		'Sentience.Consciousness.Sympathy': new (data: { target?: string; intensity?: number; message?: string }) => Sentience_Consciousness_Sympathy;
		'Sentience.Memory': new (data: { content?: string; emotion?: string; intensity?: number; topic?: string }) => Sentience_Memory;
	}
}

import type { TypeRegistry } from 'mnemonica';
export type { TypeRegistry };