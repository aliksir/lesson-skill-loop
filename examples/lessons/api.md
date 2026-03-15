# API Lessons

### Rate Limiting `[api]` `[auth]`
- **Always check rate limit headers**: `X-RateLimit-Remaining` tells you how many requests you have left
- **Implement exponential backoff**: Start at 1s, double each retry, max 3 retries
- **429 means stop, not retry immediately**: Wait for `Retry-After` header value

### Authentication `[api]` `[auth]`
- **Never hardcode API keys**: Use environment variables or secret managers
- **Token refresh before expiry**: Refresh OAuth tokens 5 minutes before expiration, not after failure
- **Check scopes on 403**: Permission denied usually means wrong scope, not wrong token

### Error Handling `[api]` `[error]`
- **Log the full response on 5xx**: Server errors are often transient but the response body has debugging clues
- **Distinguish network errors from API errors**: `ConnectionError` != `HTTPError`. Retry the former, report the latter
- **Timeout is not an error**: Set reasonable timeouts (30s for API calls) and handle `TimeoutError` separately
