# Security Policy

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, open a [GitHub Security Advisory](https://github.com/kylebrodeur/mcp-network-analyzer/security/advisories/new) or email the maintainer directly.

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You'll receive a response within 7 days.

## Security Considerations

### Browser Automation

This tool launches a headless Chromium browser to capture network traffic. Be aware of the following:

- **Only capture traffic from sites you own or have permission to test.** Unauthorized traffic capture may violate terms of service or local laws.
- The browser runs with stealth settings to avoid bot detection. Do not use this to bypass security controls you are not authorized to test.
- Captured data (headers, cookies, tokens) is stored in plaintext in the `data/` directory. Secure this directory appropriately, especially in shared environments.

### Sensitive Data in Captures

Captured sessions may contain:
- Authentication cookies and tokens
- API keys in headers or request bodies
- Personally identifiable information (PII) in responses

Do not commit the `data/` directory to version control (it is gitignored by default). Review captures before sharing them.

### HTTP Transport Mode

HTTP/hosted transport is available in `mcp-network-analyzer-pro`. If you are running the pro package, the server listens on all interfaces by default (`0.0.0.0`). In production:

- Bind to localhost if not serving remote clients: `HOST=127.0.0.1 node dist/index.js`
- Place behind a reverse proxy with TLS
- Use authentication headers to restrict access
