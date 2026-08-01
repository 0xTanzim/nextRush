# auth.md — Agent Registration for nextrush.dev

## About This Document

This is the Agent Registration document for nextrush.dev. It describes how AI agents authenticate, register, and access resources on this site.

**OAuth Protected Resource Metadata** is published at `/.well-known/oauth-protected-resource`.
**OAuth Authorization Server Metadata** is published at `/.well-known/oauth-authorization-server`.

## Audience

This document is intended for AI agents, crawlers, and automated clients seeking to access nextrush.dev content.

## Registration

nextrush.dev is an open-access documentation site. All content is publicly available. No registration, API key, or authentication is required.

### Registration Method

- **Type**: Open Access (no registration required)
- **Process**: None. Agents may begin using endpoints immediately.
- **Credentials**: None needed.

### agent_auth

```json
{
  "agent_auth": {
    "skill": "auth.md",
    "register_uri": "https://nextrush.dev/auth.md",
    "methods": [
      {
        "type": "open_access",
        "description": "No registration required. All endpoints are public."
      }
    ]
  }
}
```

## Agent Capabilities

| Capability | Endpoint | Format |
|---|---|---|
| Documentation | `GET /docs/*` | Markdown (via `Accept: text/markdown`) |
| Blog | `GET /blog/*` | Markdown (via `Accept: text/markdown`) |
| Skills discovery | `GET /.well-known/agent-skills/index.json` | JSON |
| API catalog | `GET /.well-known/api-catalog` | RFC 9727 Linkset |
| LLM docs | `GET /llms.txt` | Text |
| Full LLM docs | `GET /llms-full.txt` | Text |
| MCP Server Card | `GET /.well-known/mcp/server-card.json` | JSON |
| A2A Agent Card | `GET /.well-known/agent-card.json` | JSON |

## OAuth Protected Resource

```
GET /.well-known/oauth-protected-resource
Content-Type: application/oauth-protected-resource-v1+json
```

Authorization server: `https://nextrush.dev`

## DNS-AID Discovery

DNS-AID records under `_agents.nextrush.dev`:
- `_index._agents.nextrush.dev`: Agent discovery entry
- `_a2a._agents.nextrush.dev`: A2A interface
- `_mcp._agents.nextrush.dev`: MCP capabilities

## Access Policies

- **Authentication**: None
- **Rate limiting**: None
- **Robots**: All agents permitted
- **DNSSEC**: Enabled

## Contact

https://nextrush.dev/docs
