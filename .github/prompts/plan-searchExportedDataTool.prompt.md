# Plan: Implement search_exported_data Tool

A complete search implementation that leverages the existing rich capture data, analysis results, and database infrastructure to provide powerful querying capabilities across all exported network traffic.

## Steps

1. **Create search tool implementation** in `src/tools/search.ts` with query parsing, filtering logic, and result formatting
2. **Enhance database service** in `src/lib/database.ts` with full-text search indexing and advanced filtering methods
3. **Add content indexing** to capture pipeline in `src/tools/capture.ts` for request/response body searchability
4. **Update tool registration** in `src/index.ts` to wire the implemented search functionality
5. **Add search result aggregation** with grouping by domain, endpoint, status code, and content type

## Further Considerations

1. **Search scope strategy**: Should we index request bodies, response bodies, or both? Consider performance vs completeness tradeoffs
2. **Indexing approach**: Use SQLite FTS5 for full-text search or implement simpler JSON-based filtering first?
3. **Result format**: Return raw matches, summarized statistics, or both? How should large result sets be paginated?
