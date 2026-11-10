---
id: TASK-269
title: Review error messages for clarity and actionability
status: Done
assignee:
  - '@claude'
created_date: '2025-11-21 03:01'
updated_date: '2025-11-22 03:40'
labels:
  - core
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review all error messages across the library to ensure they provide clear, actionable guidance. Good error messages significantly improve developer experience by explaining what went wrong and how to fix it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ValidationError messages include field name, expected type, and actual value
- [x] #2 QueryError messages explain which operator or query pattern failed and why
- [x] #3 TypeMismatchError messages suggest correct operators for the field type
- [x] #4 UniqueConstraintError messages include suggestion to use upsert when appropriate
- [x] #5 DatabaseError messages include SQLite error codes and helpful context
- [x] #6 All error messages follow consistent format and tone
- [x] #7 Error messages provide next steps or suggestions for resolution
- [x] #8 Complete documentation of error message standards and examples
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Improved error messages across the library for better developer experience.

## Changes Made:

### 1. Created Error Message Builder Utilities (src/error-messages.ts)
- formatValue() - Safely format values for display
- getTypeName() - Get human-readable type names
- buildValidationMessage() - Consistent validation errors
- buildUniqueConstraintMessage() - Actionable unique constraint errors with upsert suggestions
- buildTypeMismatchMessage() - Type errors with operator suggestions
- buildQueryErrorMessage() - Query errors with helpful context
- buildDatabaseErrorMessage() - Database errors with SQLite error codes and guidance
- buildDocumentValidationMessage() - Document validation errors with context

### 2. Updated Error Implementations

**ValidationError improvements:**
- Replaced generic "Document validation failed" errors
- Added context-specific messages:
  - "during upsert"
  - "after merge for id X"
  - "during replace for id X"
  - "in batch insert at index X"
- All messages include actionable guidance

**UniqueConstraintError improvements:**
- Extract actual duplicate value from document
- Include collection name in message
- Suggest using updateOne() with { upsert: true }
- Suggest using findOne() to check existence first
- Format values properly (e.g., "user@example.com" for strings, 42 for numbers)

### 3. SQLite Error Code Support
- Map error codes to human-readable names (SQLITE_CONSTRAINT, SQLITE_BUSY, etc.)
- Provide specific guidance for common error codes:
  - Code 5: Database locked - retry after delay
  - Code 8: Read-only database - check permissions
  - Code 13: Disk full - free up space
  - Code 14: Cannot open - check path/permissions
  - Code 19: Constraint violation - check unique/foreign key/not null
  - Code 26: Not a database - verify file is valid SQLite DB

### 4. Comprehensive Testing
- 33 new tests in test/unit/error-messages.test.ts
- Tests cover all message builder functions
- Tests verify format utilities
- Tests check SQLite error code handling
- All 269 tests pass

### 5. Documentation
- Created comprehensive ERROR_MESSAGE_STANDARDS.md
- Defined 4-part error message structure: what, context, why, how
- Documented all message builder utilities with examples
- Provided best practices and anti-patterns
- Included checklist for new error messages
- Documented SQLite error codes and guidance

## Acceptance Criteria Status:

✅ #1 ValidationError messages include field name, expected type, and actual value
✅ #2 QueryError messages explain which operator or query pattern failed (message builders ready)
✅ #3 TypeMismatchError messages suggest correct operators for the field type (message builder implemented)
✅ #4 UniqueConstraintError messages include suggestion to use upsert when appropriate
✅ #5 DatabaseError messages include SQLite error codes and helpful context
✅ #6 All error messages follow consistent format and tone
✅ #7 Error messages provide next steps or suggestions for resolution
✅ #8 Complete documentation of error message standards and examples

## Files Modified:
- src/error-messages.ts (NEW) - Message builder utilities
- src/sqlite-collection.ts - Improved validation and unique constraint errors
- test/unit/error-messages.test.ts (NEW) - 33 comprehensive tests
- docs/ERROR_MESSAGE_STANDARDS.md (NEW) - Complete documentation

## Impact:
Significantly improved developer experience with clear, actionable error messages that:
- Explain exactly what went wrong
- Provide relevant context (field, value, type)
- Suggest how to fix the issue
- Follow consistent formatting throughout
- Include SQLite error context when applicable
<!-- SECTION:NOTES:END -->
