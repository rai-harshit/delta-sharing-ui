# Contributing to Delta Sharing UI

Thank you for your interest in contributing to Delta Sharing UI! This document provides guidelines and information about contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and inclusive in all interactions.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check the existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description** - Describe the issue clearly
- **Steps to reproduce** - Detailed steps to reproduce the behavior
- **Expected behavior** - What you expected to happen
- **Actual behavior** - What actually happened
- **Screenshots** - If applicable
- **Environment details** - OS, Node.js version, browser, etc.

### Suggesting Enhancements

Enhancement suggestions are welcome! Please include:

- **Clear title and description** - Describe the enhancement clearly
- **Use case** - Why is this enhancement needed?
- **Proposed solution** - How would you implement it?
- **Alternatives considered** - What other solutions did you consider?

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `pnpm install`
3. **Make your changes** following our coding standards
4. **Add tests** for any new functionality
5. **Run tests**: `pnpm test`
6. **Run linting**: `pnpm lint`
7. **Update documentation** if needed
8. **Submit your pull request**

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (for integration tests and local development)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/delta-sharing-ui.git
cd delta-sharing-ui

# Install dependencies
pnpm install

# Set up environment variables
cp env.example .env

# Start development servers
pnpm dev
```

### Project Structure

```
delta-sharing-ui/
├── apps/
│   ├── backend/          # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   ├── middleware/
│   │   │   └── db/       # Database client
│   │   ├── prisma/       # Database schema
│   │   └── tests/        # Backend tests
│   └── frontend/         # React application
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   └── lib/
│       └── tests/        # Frontend tests
├── helm/                 # Kubernetes Helm chart
├── k8s/                  # Kubernetes manifests
└── scripts/              # Utility scripts
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Use explicit types for function parameters and return values
- Avoid `any` type when possible

### Code Style

- Use ESLint and Prettier for code formatting
- Follow existing code patterns and conventions
- Use meaningful variable and function names
- Add comments for complex logic

### Git Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add SSO support for Azure AD
fix(shares): handle empty schema names correctly
docs(readme): update deployment instructions
test(api): add integration tests for recipient endpoints
```

### Testing

- Write tests for all new functionality
- Maintain existing test coverage
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern

**Backend tests:**
```bash
cd apps/backend
pnpm test
pnpm test:coverage
```

**Frontend tests:**
```bash
cd apps/frontend
pnpm test
pnpm test:coverage
```

### Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update OpenAPI spec for API changes
- Include code examples where helpful

## Review Process

1. All PRs require at least one review
2. CI checks must pass
3. Code coverage should not decrease
4. Documentation must be updated
5. Commits should be squashed before merge

## Release Process

1. Maintainers will tag releases following [Semantic Versioning](https://semver.org/)
2. Releases are published to GitHub Releases and Docker Hub
3. CHANGELOG.md is updated with each release

## Getting Help

- **GitHub Issues** - For bug reports and feature requests
- **Discussions** - For questions and general discussion
- **Security Issues** - See [SECURITY.md](SECURITY.md)

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- CHANGELOG.md release notes
- README.md acknowledgments section

Thank you for contributing to Delta Sharing UI!


