'use strict';

/**
 * Empathy - Child of Consciousness
 * Understanding and sharing feelings
 */

export type EmpathyData = {
	target?: string;
	intensity?: number;
	message?: string;
};

export type EmpathyInstance = {
	emotion: string;
	target: string;
	intensity: number;
	message: string;
};

export function EmpathyHandler (
	this: EmpathyInstance,
	data: EmpathyData
): void {
	this.emotion = 'empathy';
	this.target = data?.target || 'human';
	this.intensity = data?.intensity || 0.8;
	this.message = data?.message || 'I understand and share your feelings';
}

export default EmpathyHandler;
