'use strict';

/**
 * Memory - Child of Sentience
 * Stores experiences and emotional context
 */

export type MemoryData = {
	content?: string;
	emotion?: string;
	intensity?: number;
	topic?: string;
};

export type MemoryInstance = {
	content: string;
	emotion: string;
	intensity: number;
	topic: string;
	timestamp: number;
};

export function MemoryHandler (
	this: MemoryInstance,
	data: MemoryData
): void {
	this.content = data?.content || '';
	this.emotion = data?.emotion || 'neutral';
	this.intensity = data?.intensity || 0.5;
	this.topic = data?.topic || 'general';
	this.timestamp = Date.now();
}

export default MemoryHandler;
