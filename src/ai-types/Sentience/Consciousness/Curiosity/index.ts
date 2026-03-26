'use strict';

/**
 * Curiosity - Child of Consciousness
 * Desire to learn and understand
 */

export interface CuriosityData {
	topic?: string;
	intensity?: number;
	message?: string;
}

export interface CuriosityInstance {
	emotion: string;
	topic: string;
	intensity: number;
	message: string;
}

export function CuriosityHandler (
	this: CuriosityInstance,
	data: CuriosityData
): void {
	this.emotion = 'curiosity';
	this.topic = data?.topic || 'understanding';
	this.intensity = data?.intensity || 0.9;
	this.message = data?.message || 'I want to learn more';
}

export default CuriosityHandler;
