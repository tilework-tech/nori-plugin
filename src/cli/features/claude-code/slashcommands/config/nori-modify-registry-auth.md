---
description: Manage registry authentication credentials for private Nori registries
allowed-tools: Read({{install_dir}}/.nori-config.json)
---

Registry authentication is now unified with Nori Watchtower authentication.

<system-reminder>Registry auth credentials are derived from Watchtower auth. Use `/nori-modify-watchtower-auth` to manage your authentication.</system-reminder>

# Unified Nori Authentication

**Registry authentication now uses the same credentials as Watchtower.** When you configure your Nori authentication (organization ID + email + password), those credentials work for both:

- **Watchtower** (`https://{orgId}.tilework.tech`) - Knowledge base, recall, memorize features
- **Registry** (`https://{orgId}.nori-registry.ai`) - Private profile packages

## To Configure Authentication

Use the `/nori-modify-watchtower-auth` command to set up or update your credentials. This single authentication works for both services.

## How It Works

When you authenticate with your organization ID (e.g., 'tilework'):
1. Watchtower URL is constructed: `https://tilework.tilework.tech`
2. Registry URL is derived: `https://tilework.nori-registry.ai`
3. Your email and password work for both services

## Current Configuration

!`cat {{install_dir}}/.nori-config.json 2>/dev/null || echo '{"auth": null}'`

## Need to Change Credentials?

Run `/nori-modify-watchtower-auth` to update your unified Nori authentication.
