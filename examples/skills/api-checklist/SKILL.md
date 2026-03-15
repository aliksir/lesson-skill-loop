---
name: api-checklist
description: API integration checklist based on past lessons.
---

# API Integration Checklist

- [ ] **Rate limit handling**: Check `X-RateLimit-Remaining`, implement exponential backoff
- [ ] **API keys in env vars**: No hardcoded secrets in source code
- [ ] **Token refresh**: Refresh OAuth tokens before expiry, not after failure
- [ ] **Timeout configured**: Set reasonable timeouts (30s default)
- [ ] **Error classification**: Distinguish network errors from API errors
