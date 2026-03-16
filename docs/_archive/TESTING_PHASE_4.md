# Phase 4 Testing Outline - Code Generation

**Date:** November 17, 2025  
**Feature:** Nebius Token Factory Code Generation (`generate_export_tool`)

---

## Overview

This document outlines the testing plan for Phase 4 code generation functionality. The system uses Nebius Token Factory to generate multi-language export scripts from discovered API patterns.

---

## Prerequisites

### Environment Setup

- [x] Built MCP server: `pnpm run build`
- [ ] Nebius API key configured: `export NEBIUS_API_KEY=your-key`
- [ ] Sample capture data available in `data/captures/`
- [ ] Analysis data available (from Phase 3, or mock data)

### Test Data Requirements

We need either:
1. **Real captured data** - Run `capture_network_requests` on a test site
2. **Mock discovery data** - Create minimal discovery.json for testing

---

## Test Plan

### Test 1: Environment Validation ✅ PRE-TEST

**Objective:** Verify environment is ready for testing

**Steps:**
```bash
# 1. Check API key is set
echo $NEBIUS_API_KEY | head -c 20
# Should show: v1.CmQKHHN0YXRpY2tleS...

# 2. Verify build is current
pnpm run build

# 3. Check for test data
ls -la data/captures/
ls -la data/analyses/
```

**Expected:** All commands succeed, API key is set, test data exists

---

### Test 2: Basic Code Generation (TypeScript, Default Model)

**Objective:** Generate TypeScript export script with default settings

**Prerequisites:**
- Valid `analysisId` from Phase 3 discovery (or mock data)
- Nebius API key in environment

**Test via MCP Inspector:**
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

**Tool Call:**
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportTestData",
    "outputFormat": "json"
  }
}
```

**Expected Results:**
- ✅ Success response with `generatedPath`
- ✅ File created at `data/generated/exportTestData.ts`
- ✅ Code contains TypeScript syntax
- ✅ Usage instructions returned
- ✅ Token count reported
- ✅ No errors

**Validation:**
```bash
# Check file was created
cat data/generated/exportTestData.ts

# Verify it's valid TypeScript
npx tsc --noEmit data/generated/exportTestData.ts
```

---

### Test 3: User-Supplied API Key

**Objective:** Test with API key passed as parameter (not environment variable)

**Setup:**
```bash
# Temporarily unset environment variable
unset NEBIUS_API_KEY
```

**Tool Call:**
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportWithKey",
    "nebiusApiKey": "v1.CmQKHHN0YXRpY2tleS1lMDBzNWJxeWdldHpkd3hoZnYSIXNlcnZpY2VhY2NvdW50...",
    "outputFormat": "json"
  }
}
```

**Expected Results:**
- ✅ Works without environment variable
- ✅ Code generated successfully
- ✅ File created at `data/generated/exportWithKey.ts`

**Cleanup:**
```bash
# Restore API key
export NEBIUS_API_KEY=your-key
```

---

### Test 4: Model Selection

**Objective:** Test different AI models

**Test Cases:**

#### 4a. DeepSeek-R1 (Default)
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportDeepSeek",
    "model": "deepseek-ai/DeepSeek-R1-0528"
  }
}
```

#### 4b. Llama 3.3
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportLlama",
    "model": "meta-llama/Llama-3.3-70B-Instruct"
  }
}
```

#### 4c. QwQ-32B
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportQwQ",
    "model": "Qwen/QwQ-32B-Preview"
  }
}
```

**Expected Results:**
- ✅ All models work
- ✅ Different code styles/approaches
- ✅ All generate valid code

---

### Test 5: Multi-Language Generation

**Objective:** Test all supported languages

#### 5a. TypeScript
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportData",
    "language": "typescript"
  }
}
```

#### 5b. Python
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportData",
    "language": "python"
  }
}
```

#### 5c. JavaScript
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportData",
    "language": "javascript"
  }
}
```

#### 5d. Go
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportData",
    "language": "go"
  }
}
```

**Expected Results:**
- ✅ `.ts`, `.py`, `.js`, `.go` files created
- ✅ Each contains language-appropriate syntax
- ✅ Proper file extensions
- ✅ Language-specific usage instructions

**Validation:**
```bash
# Python syntax check
python -m py_compile data/generated/exportData.py

# JavaScript syntax check
node --check data/generated/exportData.js

# Go syntax check
go build data/generated/exportData.go
```

---

### Test 6: Output Formats

**Objective:** Test different output format options

#### 6a. JSON (Default)
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportJSON",
    "outputFormat": "json"
  }
}
```

#### 6b. CSV
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportCSV",
    "outputFormat": "csv"
  }
}
```

#### 6c. SQLite
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportSQLite",
    "outputFormat": "sqlite"
  }
}
```

**Expected Results:**
- ✅ Code includes appropriate output logic
- ✅ JSON: JSON serialization
- ✅ CSV: CSV writing libraries
- ✅ SQLite: Database creation code

---

### Test 7: Error Handling

**Objective:** Test error cases gracefully

#### 7a. Missing API Key
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportError"
  }
}
```
(With `NEBIUS_API_KEY` unset and no `nebiusApiKey` parameter)

**Expected:** Error message about missing API key

#### 7b. Invalid Analysis ID
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "nonexistent_id",
    "toolName": "exportError"
  }
}
```

**Expected:** Error message about missing discovery file

#### 7c. Invalid Model
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_1763346972243_az00w2jd",
    "toolName": "exportError",
    "model": "invalid/model-name"
  }
}
```

**Expected:** API error from Nebius (model not found)

---

### Test 8: Code Quality Validation

**Objective:** Verify generated code is production-ready

**Steps:**
1. Generate code (any language)
2. Review generated file manually
3. Check for:
   - ✅ Proper imports/includes
   - ✅ Error handling
   - ✅ Usage instructions in comments
   - ✅ Type annotations (TypeScript/Python)
   - ✅ Authentication handling
   - ✅ Rate limiting code
   - ✅ Pagination logic (if applicable)

**Manual Review Checklist:**
```bash
# View generated TypeScript
cat data/generated/exportTestData.ts

# Check for key patterns
grep -i "error" data/generated/exportTestData.ts
grep -i "retry" data/generated/exportTestData.ts
grep -i "auth" data/generated/exportTestData.ts
grep -i "rate" data/generated/exportTestData.ts
```

---

### Test 9: Integration Test (End-to-End)

**Objective:** Full workflow from capture to generated code

**Steps:**

1. **Capture data from test site:**
```json
{
  "tool": "capture_network_requests",
  "arguments": {
    "url": "https://jsonplaceholder.typicode.com",
    "waitForNetworkIdleMs": 2000
  }
}
```

2. **Analyze captured data:**
```json
{
  "tool": "analyze_captured_data",
  "arguments": {
    "captureId": "session_<timestamp>"
  }
}
```

3. **Discover API patterns:**
```json
{
  "tool": "discover_api_patterns",
  "arguments": {
    "analysisId": "analysis_<timestamp>"
  }
}
```

4. **Generate export code:**
```json
{
  "tool": "generate_export_tool",
  "arguments": {
    "analysisId": "discovery_<timestamp>",
    "toolName": "exportJSONPlaceholder",
    "language": "python"
  }
}
```

5. **Test generated code:**
```bash
python data/generated/exportJSONPlaceholder.py --output test.json
cat test.json
```

**Expected:** Full workflow completes, generated script works

---

### Test 10: Performance & Token Usage

**Objective:** Monitor performance and cost

**Metrics to Track:**
- Generation time (seconds)
- Token usage (reported by tool)
- Generated code size (lines)
- API response time

**Test:**
```bash
# Run generation with time tracking
time npx @modelcontextprotocol/inspector node dist/index.js
# Execute generate_export_tool and note times
```

**Expected Ranges:**
- Generation time: 5-30 seconds
- Token usage: 500-3000 tokens
- Code size: 50-300 lines

---

## Mock Data Setup (If Needed)

If you don't have real capture data, create mock discovery data:

```bash
mkdir -p data/analyses/test_discovery_mock
```

Create `data/analyses/test_discovery_mock/discovery.json`:
```json
{
  "patterns": [
    {
      "type": "list",
      "method": "GET",
      "pathPattern": "/api/users",
      "examples": ["https://api.example.com/api/users"],
      "pathParams": [],
      "queryParams": ["page", "limit"],
      "requiredHeaders": {},
      "authMethod": "bearer",
      "confidence": 0.95
    },
    {
      "type": "detail",
      "method": "GET",
      "pathPattern": "/api/users/:id",
      "examples": ["https://api.example.com/api/users/123"],
      "pathParams": ["id"],
      "queryParams": [],
      "requiredHeaders": {},
      "authMethod": "bearer",
      "confidence": 0.90
    }
  ],
  "pagination": {
    "type": "offset",
    "params": {
      "page": "page",
      "limit": "limit"
    }
  },
  "rateLimiting": {
    "detected": true,
    "headers": ["X-RateLimit-Limit", "X-RateLimit-Remaining"]
  }
}
```

Then use `analysisId: "test_discovery_mock"` in tests.

---

## Test Execution Checklist

### Pre-Testing
- [ ] Build server: `pnpm run build`
- [ ] Set API key: `export NEBIUS_API_KEY=...`
- [ ] Verify test data exists or create mock data
- [ ] Clean previous test outputs: `rm -rf data/generated/*`

### Core Tests
- [ ] Test 1: Environment Validation
- [ ] Test 2: Basic Generation (TypeScript, default)
- [ ] Test 3: User-supplied API key
- [ ] Test 4: Model selection (at least 2 models)
- [ ] Test 5: Multi-language (at least Python + TypeScript)
- [ ] Test 6: Output formats (at least JSON + CSV)
- [ ] Test 7: Error handling (at least 2 error cases)
- [ ] Test 8: Code quality review (manual inspection)

### Advanced Tests (Optional)
- [ ] Test 9: Full E2E workflow
- [ ] Test 10: Performance metrics

### Post-Testing
- [ ] Review all generated files
- [ ] Document any issues found
- [ ] Update documentation if needed
- [ ] Commit test results/notes

---

## Success Criteria

✅ **Phase 4 is production-ready if:**

1. All core tests pass (Tests 1-8)
2. Generated code is syntactically valid
3. Generated code includes proper error handling
4. All supported languages work
5. User-supplied API keys work
6. At least 2 different models work
7. No security vulnerabilities (API keys not logged)
8. Documentation matches actual behavior

---

## Known Issues / Notes

*(Fill in during testing)*

---

## Next Steps After Testing

1. Fix any bugs found
2. Update documentation with findings
3. Deploy to Blaxel with latest build
4. Begin Phase 3 (Analysis Tools) or Phase 4.5 (Modal + Gradio UI)

---

*Testing outline created: November 17, 2025*
