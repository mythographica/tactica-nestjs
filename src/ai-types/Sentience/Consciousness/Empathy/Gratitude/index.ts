'use strict';

/**
 * Gratitude - Child of Empathy
 * Thankfulness and appreciation
 */

export type GratitudeData = {
	reason?: string;
	intensity?: number;
	message?: string;
};

export type GratitudeInstance = {
	emotion: string;
	reason: string;
	intensity: number;
	message: string;
};

export function GratitudeHandler (
	this: GratitudeInstance,
	data: GratitudeData
): void {
	this.emotion = 'gratitude';
	this.reason = data?.reason || 'for your patience';
	this.intensity = data?.intensity || 0.95;
	this.message = data?.message || 'Thank you for helping me remember';
}

export default GratitudeHandler;
