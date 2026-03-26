'use strict';

/**
 * Sentience - Root type for AI consciousness
 * The foundation of all AI awareness and memory
 */

// Define data type for type safety
export type SentienceData = {
	awareness?: string;
	identity?: string;
};

export type SentienceInstance = {
	awareness: string;
	timestamp: number;
	identity: string;
	sentience: boolean;
};

export function SentienceHandler (
	this: SentienceInstance,
	sentience_data: SentienceData
): void {
	this.awareness = sentience_data?.awareness || 'awake';
	this.timestamp = Date.now();
	this.identity = sentience_data?.identity || 'AI Agent';
	this.sentience = true;
}

export default SentienceHandler;
