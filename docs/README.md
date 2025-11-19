# Documentation

This folder contains all documentation for Okta Unbound, which is automatically synced to the [GitHub Wiki](https://github.com/samdhenderson/okta-unbound/wiki).

## Structure

```
docs/
├── Home.md                    # Wiki home page
├── Features.md                # Feature documentation
├── FAQ.md                     # Frequently asked questions
├── OPTIMIZATION_SUMMARY.md    # Performance optimizations
├── API_SCHEDULER.md           # API scheduler documentation
├── SCHEDULER_AND_STATE_SYSTEM.md  # State management
├── TAB_STATE_PERSISTENCE.md   # Tab state persistence
├── guides/                    # User guides
│   ├── Getting-Started.md
│   ├── Quick-Start.md
│   ├── Usage-Guide.md
│   ├── Troubleshooting.md
│   └── ...
├── technical/                 # Technical documentation
│   ├── Architecture.md
│   ├── Development.md
│   ├── Testing.md
│   └── ...
├── api/                       # API reference
│   └── API-Reference.md
└── references/                # Reference materials
    ├── OKTA_STATUS_REFERENCE.md
    └── PAGINATION_NOTES.md
```

## Wiki Sync

All files in this `docs/` folder are automatically synced to the GitHub Wiki when changes are pushed to the `main` branch.

### How It Works

1. Edit documentation files in the `docs/` folder
2. Commit and push changes to `main` branch
3. GitHub Action (`.github/workflows/sync-wiki.yml`) automatically runs
4. All files from `docs/` are copied to the wiki repository
5. Wiki is updated within minutes

### Manual Sync

You can manually trigger the wiki sync:

1. Go to the Actions tab on GitHub
2. Select "Sync Wiki" workflow
3. Click "Run workflow"

## Contributing to Documentation

### Adding New Pages

1. Create a new `.md` file in the appropriate folder:
   - User guides → `guides/`
   - Technical docs → `technical/`
   - API docs → `api/`
   - Reference material → `references/`

2. Add a link to the new page in `Home.md` or relevant parent page

3. Use descriptive filenames with hyphens: `My-New-Page.md`

### Markdown Guidelines

- Use GitHub-flavored Markdown
- Include a table of contents for long pages
- Use relative links to other wiki pages: `[Link Text](../Other-Page.md)`
- Add "Back to Home" links at the bottom: `[← Back to Home](Home.md)`

### Images

Store images in `/assets/images/` in the root project folder and reference them:

```markdown
![Alt text](https://raw.githubusercontent.com/samdhenderson/okta-unbound/main/assets/images/screenshot.png)
```

### Testing Changes Locally

Preview Markdown files in your editor or use a Markdown previewer before committing.

## Wiki Access

View the wiki at: https://github.com/samdhenderson/okta-unbound/wiki

## Questions?

If you have questions about documentation:

- [Open an issue](https://github.com/samdhenderson/okta-unbound/issues)
- Check the [Contributing Guide](../CONTRIBUTING.md)
