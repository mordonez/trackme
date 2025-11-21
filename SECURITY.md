# Security Documentation - TrackMe

## Overview

This document outlines the security measures implemented in TrackMe, following DevSecOps best practices.

## Architecture & Code Organization

### Modular Structure

The codebase is organized into logical sections for better maintainability and security auditing:

```
src/index.js
├── Configuration & Constants
├── Security: HTTP Headers
├── Security: Input Validation & Sanitization
├── Security: Authentication & Token Management
├── Database Operations
├── Utility Functions
├── Client-Side Templates (CSS)
├── Client-Side Templates (JavaScript)
├── HTML Templates
├── API Handlers
└── Main Worker Handler
```

This separation of concerns makes it easier to:
- Audit security-critical code
- Update security policies
- Test individual components
- Maintain and extend the application

## Security Measures Implemented

### 1. Security Headers (OWASP Best Practices)

All responses include comprehensive security headers:

#### Content Security Policy (CSP)
```
Content-Security-Policy: default-src 'self'; script-src 'unsafe-inline' 'self';
  style-src 'unsafe-inline' 'self'; img-src 'self' data:; connect-src 'self';
  font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
  frame-ancestors 'none'; upgrade-insecure-requests
```
- Prevents XSS attacks by restricting resource loading
- Blocks unauthorized external scripts
- Prevents clickjacking with `frame-ancestors 'none'`

#### HTTP Strict Transport Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
- Forces HTTPS connections
- Prevents SSL stripping attacks
- Includes subdomains in protection

#### Additional Security Headers
- `X-Content-Type-Options: nosniff` - Prevents MIME-type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - Enables browser XSS filter
- `Referrer-Policy: strict-origin-when-cross-origin` - Limits referrer information leakage
- `Permissions-Policy` - Restricts access to browser features (geolocation, microphone, camera)

### 2. Input Validation & Sanitization

All user inputs are validated and sanitized before processing:

#### String Sanitization
```javascript
function sanitizeString(input, maxLength = 1000) {
  - Removes null bytes (\0)
  - Trims whitespace
  - Enforces length limits
  - Returns empty string for non-string inputs
}
```

#### Specific Validators

**Credentials Validation**
- Type checking (must be strings)
- Length limits (max 100 characters)
- Sanitization applied

**Symptom Name Validation**
- Required field checking
- SQL injection pattern detection (defense in depth)
- Length limit (100 characters)
- Empty string rejection

**Notes Validation**
- Optional field handling
- Type checking
- Length limit (1000 characters)

**ID Validation**
- Integer parsing
- Range checking (must be >= 1)
- NaN rejection

### 3. SQL Injection Prevention

Multiple layers of protection:

1. **Parameterized Queries**: All database queries use parameter binding
   ```javascript
   db.prepare('SELECT * FROM table WHERE id = ?').bind(id)
   ```

2. **Input Validation**: Defense in depth with SQL keyword detection

3. **ORM Protection**: Using Cloudflare D1's safe query interface

### 4. Cross-Site Scripting (XSS) Prevention

#### Server-Side
- Security headers (CSP)
- Input sanitization
- Output encoding

#### Client-Side
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;  // Automatically escapes HTML
  return div.innerHTML;
}
```
- All user-generated content is escaped before rendering
- HTML entities are properly encoded

### 5. Authentication & Token Management

#### Secure Token Generation
```javascript
function generateSecureToken(username, password) {
  - Includes timestamp for expiry tracking
  - Adds random component for additional entropy
  - Base64 encoded for safe transmission
}
```

#### Token Validation
- Type checking
- Length validation (max 500 chars to prevent DoS)
- Credential verification
- Expiry checking (7 days default)
- Error handling with fallback to rejection

#### Authentication Flow
- Bearer token authentication
- Centralized auth checking
- Automatic logout on token expiry
- Protected routes require valid tokens

### 6. Rate Limiting Considerations

While not fully implemented (would require Cloudflare Workers KV or Durable Objects), the architecture supports rate limiting:

- Timing attack prevention with delays on failed logins
- Token expiry limits session duration
- Input length limits prevent payload attacks

**Recommended Implementation** (future):
```javascript
// Using Cloudflare Workers KV
const loginAttempts = await env.KV.get(`login:${ip}`);
if (loginAttempts > 5) {
  return jsonResponse({ error: 'Too many attempts' }, headers, 429);
}
```

### 7. Database Security

#### Schema Design
- Foreign key constraints for referential integrity
- Cascade deletes for data consistency
- Unique constraints on symptom names
- Proper indexing for performance (reduces DoS risk)

#### Indices
```sql
CREATE INDEX idx_symptom_logs_date ON symptom_logs(date DESC)
CREATE INDEX idx_symptom_logs_type_id ON symptom_logs(type_id)
```

#### Query Optimization
- LIMIT clauses to prevent resource exhaustion
- Efficient date range queries
- Proper JOIN operations

### 8. Error Handling

#### Secure Error Messages
- Generic errors returned to clients (no internal details)
- Detailed errors logged server-side only
- Proper HTTP status codes
- Structured error responses

#### Error Types
```javascript
class ValidationError extends Error {
  // Custom error type for validation failures
  // Allows proper error handling and user-friendly messages
}
```

### 9. Client-Side Security

#### Input Constraints
- HTML `maxlength` attributes on inputs
- Client-side validation before API calls
- Input trimming
- Length checking

#### Security Features
- Escape key to close modals
- Click-outside-to-close for modals
- Password fields use proper `type="password"`
- Autocomplete attributes for credential fields

### 10. CORS Configuration

Current: Permissive (`*`) for development

**Production Recommendation**:
```javascript
'Access-Control-Allow-Origin': env.FRONTEND_URL || 'https://yourdomain.com'
```

## Configuration Management

### Environment Variables
```
USER=admin          # Changed from default
PASSWORD=changeme   # Use strong password in production
```

**Production Checklist**:
- [ ] Change default credentials
- [ ] Use strong passwords (min 16 chars, mixed case, numbers, symbols)
- [ ] Rotate credentials regularly
- [ ] Use Cloudflare secrets management
- [ ] Enable Cloudflare Access for additional protection

## Constants & Limits

```javascript
const CONFIG = {
  TOKEN_EXPIRY_DAYS: 7,           // Token validity period
  HISTORY_DAYS: 14,                // History retention for UI
  MAX_NOTE_LENGTH: 1000,           // Prevent excessive data storage
  MAX_SYMPTOM_NAME_LENGTH: 100,    // Reasonable name length
};
```

## Threat Model

### Threats Addressed
✅ SQL Injection
✅ Cross-Site Scripting (XSS)
✅ Clickjacking
✅ MIME-type attacks
✅ Session hijacking (limited by token expiry)
✅ Timing attacks (login delay)
✅ XSS via user input
✅ CSRF (token-based auth)

### Threats Partially Addressed
⚠️ Brute force attacks (needs rate limiting)
⚠️ DDoS (relies on Cloudflare protection)

### Threats Not Addressed
❌ Advanced persistent threats (APTs)
❌ Zero-day exploits
❌ Physical security
❌ Social engineering

## Monitoring & Logging

### Current Implementation
- Console error logging
- Error categorization (validation, database, server)
- Request path logging

### Production Recommendations
1. Implement structured logging
2. Use Cloudflare Analytics
3. Set up alerts for:
   - Repeated authentication failures
   - Unusual traffic patterns
   - Error rate spikes
4. Log retention policy
5. Regular log review

## Compliance Considerations

### GDPR
- Minimal data collection (symptoms only)
- User-controlled data (can delete symptoms)
- No PII beyond user-entered notes
- Right to erasure supported

### OWASP Top 10 (2021)
1. ✅ Broken Access Control - Token-based auth, protected routes
2. ✅ Cryptographic Failures - HTTPS enforced, secure token storage
3. ✅ Injection - Parameterized queries, input validation
4. ✅ Insecure Design - Security-first architecture
5. ✅ Security Misconfiguration - Proper headers, no debug info
6. ⚠️ Vulnerable Components - Regular dependency updates needed
7. ✅ Identification and Authentication Failures - Secure auth flow
8. ✅ Software and Data Integrity Failures - CSP, resource integrity
9. ⚠️ Security Logging and Monitoring - Basic logging implemented
10. ⚠️ Server-Side Request Forgery - Not applicable to current design

## Security Update Process

1. **Regular Dependency Updates**
   ```bash
   npm audit
   npm audit fix
   npm update
   ```

2. **Security Review Schedule**
   - Monthly: Dependency audit
   - Quarterly: Security header review
   - Annually: Full security audit

3. **Incident Response**
   - Identify and isolate
   - Patch immediately
   - Notify users if data breach
   - Document and learn

## Deployment Security

### Cloudflare Workers
- Automatic DDoS protection
- SSL/TLS by default
- Global CDN
- WAF available (upgrade to Pro/Enterprise)

### Pre-Deployment Checklist
- [ ] Change default credentials
- [ ] Review CORS settings
- [ ] Enable Cloudflare WAF (if available)
- [ ] Set up monitoring
- [ ] Test authentication flow
- [ ] Verify security headers
- [ ] Run security scan
- [ ] Document any exceptions

## Testing Security

### Manual Testing
```bash
# Test SQL injection (should fail)
curl -X POST /api/admin/add-symptom \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test'; DROP TABLE symptoms; --"}'

# Test XSS (should be escaped)
curl -X POST /api/log-symptom \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type_id": 1, "notes": "<script>alert(1)</script>"}'

# Test auth (should return 401)
curl /api/symptom-types

# Test CORS preflight
curl -X OPTIONS /api/symptom-types
```

### Automated Testing Recommendations
1. OWASP ZAP scanning
2. npm audit in CI/CD
3. Dependency scanning (Snyk, Dependabot)
4. Header validation tests

## Contact & Reporting

For security issues, please follow responsible disclosure:
1. Do not publicly disclose the issue
2. Contact the maintainer directly
3. Allow reasonable time for patching
4. Coordinate disclosure timing

---

**Last Updated**: 2025-11-21
**Version**: 1.0
**Reviewed By**: Claude (AI Security Analysis)
