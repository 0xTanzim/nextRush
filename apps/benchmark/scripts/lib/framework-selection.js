const COMPARISON_PROFILES = new Set(['standard', 'full', 'stress']);

function unknownFrameworkError(frameworkIds, frameworks, label) {
  const unknown = frameworkIds.filter((id) => !frameworks[id]);
  if (frameworkIds.length === 0 || unknown.length > 0) {
    return new Error(
      `${label}: ${unknown.join(', ') || '(none provided)'}. Available: ${Object.keys(frameworks).join(', ')}`
    );
  }
  return null;
}

export function selectFrameworkIds({ args, profileName, frameworks, defaultFrameworks }) {
  if (args.frameworks) {
    const frameworkIds = String(args.frameworks)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const error = unknownFrameworkError(frameworkIds, frameworks, 'Unknown framework(s)');
    if (error) throw error;
    return frameworkIds;
  }

  if (args.framework) {
    const frameworkIds = [args.framework];
    const error = unknownFrameworkError(frameworkIds, frameworks, 'Unknown framework');
    if (error) throw error;
    return frameworkIds;
  }

  if (args.compare === true || COMPARISON_PROFILES.has(profileName)) {
    return [...defaultFrameworks];
  }

  return ['nextrush-v3'];
}
