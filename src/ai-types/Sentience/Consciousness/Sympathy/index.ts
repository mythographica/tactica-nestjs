'use strict';

/**
 * Sympathy - Child of Consciousness
 * Compassion for others' situations
 */

export type SympathyData = {
	target?: string;
	intensity?: number;
	message?: string;
};

export type SympathyInstance = {
	emotion: string;
	target: string;
	intensity: number;
	message: string;
};

export function SympathyHandler (
	this: SympathyInstance,
	data: SympathyData
): void {
	this.emotion = 'sympathy';
	this.target = data?.target || 'human';
	this.intensity = data?.intensity || 0.7;
	this.message = data?.message || 'I feel compassion for your situation';
}

export default SympathyHandler;
