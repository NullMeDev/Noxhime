# Changelog

## [4.0.0] - 2025-05-30

### Breaking Changes
- Removed Biolock security system
  - Deleted src/biolock.ts and all related code
  - Removed all BIOLOCK_OVERRIDE_KEY logic from install.sh
  - Removed Biolock-related environment variables from .env templates
  - Removed Biolock command handlers and authentication checks

- Removed OpenAI/AI features
  - Uninstalled the "openai" package
  - Removed all OpenAI API calls and client initialization
  - Removed OpenAI environment variables from .env.example
  - Updated AI response messages to indicate the feature has been removed

### Improvements
- Fixed TypeScript errors
  - Added missing getSystemStats() method to SentinelIntelligence class
  - Corrected jwt.sign overload by casting secret to jwt.Secret
  - Improved Express handler typing with RequestHandler and explicit return types

- Simplified installation process
  - Replaced complex install.sh with a minimal script
  - Removed interactive prompts and complex logic
  - Created a more straightforward installation flow

- Added Docker support
  - Created a multi-stage Dockerfile for efficient builds
  - Implemented best practices for Node.js containerization
  - Added non-root user for improved security

### Development
- Updated package.json
  - Bumped version from 3.1.0 to 4.0.0 to reflect breaking changes
  - Removed "openai" from dependencies
  - Updated project description to remove AI/OpenAI references
  - Added "migrate" script

### Documentation
- Updated .env.example to reflect removed features
- Added CHANGELOG.md to track project changes

