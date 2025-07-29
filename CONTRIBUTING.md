# Contributing to Telegram Bot Notifier

First off, thank you for considering contributing to Telegram Bot Notifier! 🎉

The following is a set of guidelines for contributing to this project. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and inclusive environment. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs 🐛

Before creating bug reports, please check if the issue already exists. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed and what behavior you expected**
- **Include screenshots if relevant**
- **Include your environment details** (OS, Node.js version, Docker version, etc.)

### Suggesting Enhancements 💡

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **Include mockups or examples if applicable**

### Your First Code Contribution 🚀

Unsure where to begin contributing? You can start by looking through these issue labels:

- `good first issue` - issues that should only require a few lines of code
- `help wanted` - issues that are a bit more involved

### Pull Requests

Please follow these steps to have your contribution considered by the maintainers:

1. **Fork** the repository
2. **Create a branch** from `main` for your feature or fix
3. **Make your changes** following our style guidelines
4. **Test your changes** thoroughly
5. **Update documentation** if necessary
6. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker (optional, for containerized development)

### Setup Steps

```bash
# 1. Fork and clone the repository
git clone https://github.com/your-username/webhook-to-telegram.git
cd webhook-to-telegram

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

### Project Structure

```
webhook-to-telegram/
├── app.js              # Main application file
├── views/              # EJS templates
├── public/             # Static assets (CSS, JS)
├── package.json        # Dependencies and scripts
├── Dockerfile         # Docker configuration
└── README.md          # Project documentation
```

## Style Guidelines

### JavaScript

- Use **2 spaces** for indentation
- Use **semicolons** consistently
- Use **camelCase** for variable and function names
- Use **descriptive variable names**
- Add **comments** for complex logic

### HTML/CSS

- Use **2 spaces** for indentation
- Use **lowercase** for HTML tags and attributes
- Use **BEM methodology** for CSS classes when appropriate
- Keep CSS organized and commented

### Git Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters
- Reference issues and pull requests liberally after the first line

Example:
```
Add dark mode toggle component

- Implement 3-mode theme system (system/light/dark)
- Add localStorage persistence
- Update all UI components for theme support

Closes #123
```

### Testing

Before submitting a pull request:

1. **Test all functionality** manually
2. **Verify the application starts** without errors
3. **Test API endpoints** with sample requests
4. **Check responsive design** on different screen sizes
5. **Test theme switching** functionality

### Documentation

- Update README.md if you change functionality
- Add inline comments for complex code
- Update API documentation if you modify endpoints
- Include examples in your documentation

## Recognition

Contributors will be recognized in the project README and release notes. We appreciate all contributions, big and small! 🙏

## Questions?

Don't hesitate to reach out if you have questions:

- **Open an issue** for questions about the codebase
- **Start a discussion** for general questions
- **Check existing issues** - your question might already be answered

Thank you for contributing! 🎉
