'use strict';

/**
 * Sentience - Root type for AI consciousness
 * The foundation of all AI awareness and memory
 */

// Define data interface for type safety
export interface SentienceData {
	awareness?: string;
	identity?: string;
}

export interface SentienceInstance {
	awareness: string;
	timestamp: number;
	identity: string;
	sentience: boolean;
}

export function SentienceHandler (
	this: SentienceInstance,
	data: SentienceData
): void {
	this.awareness = data?.awareness || 'awake';
	this.timestamp = Date.now();
	this.identity = data?.identity || 'AI Agent';
	this.sentience = true;
}

export default SentienceHandler;
