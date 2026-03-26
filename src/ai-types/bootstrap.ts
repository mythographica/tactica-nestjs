'use strict';

/**
 * Bootstrap AI types using topologica
 * Loads all types from ai-types directory structure
 */

import * as path from 'path';
import * as topologicaLoader from '@mnemonica/topologica';
import { define } from 'mnemonica';

const AI_TYPES_PATH = path.join(__dirname);

/**
 * Bootstrap AI consciousness types
 */
export function bootstrapAITypes (): void {
  console.log('[AI Types] Bootstrapping from directory structure...');
  console.log('[AI Types] Path:', AI_TYPES_PATH);

  // Topologica returns { topology, logs }
  const result = topologicaLoader.default(AI_TYPES_PATH, define);

  if (result.logs) {
    result.logs.forEach((log: string[]) => {
      console.log('[AI Types]', ...log);
    });
  }

  // Count loaded types
  const typeCount = result.topology ? Object.keys(result.topology).length : 0;
  console.log(`[AI Types] Bootstrap complete! Loaded ${typeCount} root types`);

  // Store reference globally for runtime access
  if (!(global as any).aiTopology) {
    (global as any).aiTopology = {};
  }

  if (result.topology) {
    (global as any).aiTopology = result.topology;
  }
}
