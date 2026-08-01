# auth.md — Agent Registration for nextrush.dev

## Overview

This file registers nextrush.dev as an agent-accessible resource. It describes how agents can authenticate, register, and access resources on this site.

## Audience

This document is intended for AI agents, crawlers, and automated clients.

## Registration Flow

1. **Discover** this file at `https://nextrush.dev/auth.md`
2. **Read** the OAuth Protected Resource Metadata at `/.well-known/oauth-protected-resource` to find the authorization server and supported scopes.
3. **Read** the Authorization Server Metadata at `/.well-known/oauth-authorization-server` to find supported registration methods.
4. **Select** the `auth.md` registration method from the authorization server's `agent_auth.methods`.
5. **Complete** registration by reading this document. All scopes are granted automatically upon request.
6. **Access** endpoints using the granted scopes with `Accept: text/markdown` for markdown content.

## agent_auth

```json
{
  "agent_auth": {
    "skill": "https://nextrush.dev/auth.md",
    "register_uri": "https://nextrush.dev/auth.md",
    "methods": [
      {
        "type": "auth.md",
        "url": "https://nextrush.dev/auth.md",
        "credential_types_supported": []
      }
    ]
  }
}
```

## Registration Method: auth.md

The single supported registration method is documented in this file:

- **Type**: `auth.md`
- **URL**: `https://nextrush.dev/auth.md`
- **Credentials**: None required. This is an open-access resource.
- **Scopes**: `read:docs`, `read:blog`, `read:skills`, `read:catalog`
- **Process**: No registration steps are necessary. All endpoints are publicly accessible. Agents may begin using endpoints immediately.

## Scope Table

| Scope | Resource | Endpoint |
|---|---|---|
| `read:docs` | Framework documentation | `GET /docs/*`, `GET /llms.txt`, `GET /llms-full.txt` |
| `read:blog` | Blog posts | `GET /blog/*` |
| `read:skills` | Agent skills | `GET /.well-known/agent-skills/index.json` |
| `read:catalog` | API catalog | `GET /.well-known/api-catalog` |

## Endpoint Details

All endpoints are publicly accessible. Use `Accept: text/markdown` header on documentation (`/docs/*`, `/blog/*`, `/skills/*`) paths to receive Markdown responses.

## DNS-AID Discovery

DNS-AID records published under `_agents.nextrush.dev`:
- `_index._agents.nextrush.dev` — Discovery entry
- `_a2a._agents.nextrush.dev` — A2A interface
- `_mcp._agents.nextrush.dev` — MCP capabilities

## Access Policies

- **Authentication**: None required.
- **Rate limiting**: None enforced.
- **Robots.txt**: All agents permitted.
- **DNSSEC**: Enabled with DS records.

## Contact

Documentation: https://nextrush.dev/docs
