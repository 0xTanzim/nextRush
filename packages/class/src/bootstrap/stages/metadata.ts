/**
 * Metadata stage: Extract and validate controller metadata from discovered classes.
 */

import type { BootstrapContext } from '../context.js';
import { getControllerDefinition } from '../../metadata.js';

export function metadataStage(ctx: BootstrapContext): void {
  ctx.controllerDefinitions = ctx.discoveredClasses.map((cls) => {
    const def = getControllerDefinition(cls);
    if (!def) {
      throw new Error(
        `Controller class ${cls.name} has no metadata. Did you apply @Controller?`
      );
    }
    return def;
  });
}
