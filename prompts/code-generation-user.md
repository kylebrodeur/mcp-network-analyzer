# Code Generation Request Template

This template is dynamically filled with API patterns discovered from network traffic analysis.

---

Generate a {{language}} script named "{{toolName}}" that exports data from the following API endpoints:

## API Endpoints

{{#each patterns}}
### Endpoint {{@index}}
- Type: {{type}}
- Method: {{method}}
- Path Pattern: {{pathPattern}}
- Example: {{examples.[0]}}
{{#if pathParams}}
- Path Parameters: {{join pathParams ", "}}
{{/if}}
{{#if queryParams}}
- Query Parameters: {{join queryParams ", "}}
{{/if}}
{{#if requiredHeaders}}
- Required Headers:
{{#each requiredHeaders}}
  - {{@key}}: {{this}}
{{/each}}
{{/if}}

{{/each}}

{{#if includeAuth}}
## Authentication
- Method: {{authMethod}}
- The script should accept authentication credentials as command-line arguments or environment variables
{{/if}}

{{#if includePagination}}
## Pagination
- Type: {{paginationType}}
{{#if paginationParams}}
- Parameters: {{json paginationParams}}
{{/if}}
- The script should automatically iterate through all pages
{{/if}}

{{#if includeRateLimiting}}
## Rate Limiting
- Implement rate limiting with configurable delays between requests
- Respect rate limit headers if present
{{/if}}

## Output Format
- Format: {{outputFormat}}
- Save data to a file with an appropriate name

## Requirements
- Language: {{language}}
- Use {{httpClient}} for HTTP requests (prefer native/built-in libraries)
- Include proper error handling and retry logic
- Add informative logging to track progress
- Make the script executable and well-documented
- Include usage instructions as comments at the top
- Use type annotations where applicable

Generate ONLY the complete, production-ready code without any explanations or markdown formatting. The code should be ready to save and run immediately.
