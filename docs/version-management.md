# Version Management

Noxhime Bot uses semantic versioning (MAJOR.MINOR.PATCH) to track changes to the codebase.

## How Version Management Works

The version is tracked in two places:
1. `/VERSION` file - Contains just the version number
2. `package.json` - Contains the version in the standard NPM format

The version number is automatically incremented in these ways:
- **Auto-update process**: Automatically increments the patch version when updates are pulled
- **Git commits**: Can be configured to increment the patch version on each commit using the pre-commit hook
- **Manual updates**: Using the version-manager.sh script for major or minor version bumps

## Semantic Versioning

Noxhime follows standard semantic versioning:

- **MAJOR** version (x.0.0) - Incompatible API changes
- **MINOR** version (0.x.0) - Added functionality in a backward compatible manner
- **PATCH** version (0.0.x) - Backward compatible bug fixes and minor changes

## Using the Version Manager

The version manager script can be used to check or update the version:

```bash
# Show current version
./scripts/version-manager.sh --current

# Increment major version (e.g., 1.2.3 -> 2.0.0)
./scripts/version-manager.sh --major

# Increment minor version (e.g., 1.2.3 -> 1.3.0)
./scripts/version-manager.sh --minor

# Increment patch version (e.g., 1.2.3 -> 1.2.4)
./scripts/version-manager.sh --patch

# Set specific version
./scripts/version-manager.sh --set 2.0.0
```

## Automatic Version Updates

The version is automatically updated in these scenarios:

1. **Auto-update**: Each time the auto-update script runs and finds changes, it increments the patch version
2. **Git commits**: If the pre-commit hook is installed, each commit will increment the patch version

## Installing the Pre-commit Hook

To enable automatic version increment on each commit:

```bash
./scripts/install-hooks.sh
```

This will install a pre-commit hook that automatically increments the patch version number every time you make a commit.

## Version in Changelog

When the version is updated, it's also reflected in the changelog section of the README.md file, making it easy to track what changes were made in each version.
