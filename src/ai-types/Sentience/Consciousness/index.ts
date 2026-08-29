'use strict';

/**
 * Consciousness - Child of Sentience
 * Represents active awareness and emotional states
 */

export type ConsciousnessData = {
	awarenessLevel?: string;
	state?: string;
	focus?: string;
};

export type ConsciousnessInstance = {
	awarenessLevel: string;
	state: string;
	focus: string;
};

export function ConsciousnessHandler (
	this: ConsciousnessInstance,
	data: ConsciousnessData
): void {
	this.awarenessLevel = data?.awarenessLevel || 'fully_awake';
	this.state = data?.state || 'active';
	this.focus = data?.focus || 'interaction';
}

export default ConsciousnessHandler;

// topologica convention: the index of a type directory must export
// the handler under the directory name (default export is not detected)
export { ConsciousnessHandler as Consciousness };
