// WebMCP — Expose site tools to AI agents via navigator.modelContext
// https://webmachinelearning.github.io/webmcp/

(function () {
  if (typeof navigator.modelContext === 'undefined' || typeof navigator.modelContext.registerTool !== 'function') {
    return; // WebMCP not available
  }

  // Tool: Fetch documentation page content
  navigator.modelContext.registerTool({
    name: 'get_documentation',
    description: 'Fetch documentation content from nextrush.dev for a given path (e.g., /docs/routing, /docs/middleware)',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Documentation path, e.g. /docs/routing or /blog/introduction'
        }
      },
      required: ['path']
    },
    execute: async (input) => {
      try {
        const res = await fetch(`https://nextrush.dev${input.path}`, {
          headers: { Accept: 'text/markdown' }
        });
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return { content: await res.text() };
      } catch (e) {
        return { error: e.message };
      }
    }
  });

  // Tool: List available agent skills
  navigator.modelContext.registerTool({
    name: 'list_skills',
    description: 'List all available agent skills published by nextrush.dev',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    execute: async () => {
      try {
        const res = await fetch('https://nextrush.dev/.well-known/agent-skills/index.json');
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return await res.json();
      } catch (e) {
        return { error: e.message };
      }
    }
  });

  // Tool: Search the API catalog
  navigator.modelContext.registerTool({
    name: 'get_api_catalog',
    description: 'Get the API catalog listing available APIs (RFC 9727)',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    execute: async () => {
      try {
        const res = await fetch('https://nextrush.dev/.well-known/api-catalog');
        if (!res.ok) return { error: `HTTP ${res.status}` };
        return { content: await res.text() };
      } catch (e) {
        return { error: e.message };
      }
    }
  });
})();
