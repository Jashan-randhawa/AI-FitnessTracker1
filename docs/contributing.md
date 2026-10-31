# 🤝 Contributing Guidelines

[← Back to Documentation Index](README.md)

Contributions are welcome! To ensure consistency, documentation accuracy, and safety across the repository, please adhere to the following standards.

---

## 📋 Contributor Verification Checklist

Before opening a pull request, verify each of the following:

- [ ] **Tests Pass:** Native Node runner tests in `server` and Vitest tests in `client` execute and pass cleanly.
- [ ] **Coverage Thresholds:** New or changed server code has tests; coverage thresholds still pass (`npm run test:coverage` in server).
- [ ] **Documentation Sync:** **If I renamed/moved/added an endpoint, env var, script, or file, I updated `docs/` and `docs/README.md` (index).**
- [ ] **Docs Guardrails:** Verified via `npm run docs:check` (ensures `README.md` is under 8 KB and zero broken relative links or anchors).
- [ ] **No Secrets:** Sample environment files and docs use `<placeholder>` values and follow the `openssl rand -base64 48` generation recipe.
- [ ] **Error Masking:** Database exceptions and internal topologies remain masked in production responses.

---

## 🛠️ Development Workflow

1. **Fork & Branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Commit Conventions:**
   Follow Conventional Commits:
   - `feat:` New capability or feature
   - `fix:` Bug fix or regression patch
   - `docs:` Documentation improvements
   - `test:` Adding or expanding tests
   - `refactor:` Code reorganization without functional changes

3. **Code Quality & Testing:**
   Before opening a Pull Request, verify all checks pass:
   ```bash
   # From repository root
   npm run docs:check

   # Client checks
   cd client
   npm run lint
   npm test
   npm run build

   # Server checks
   cd ../server
   npm test
   npm run test:smoke
   ```

4. **Security & Boundaries:**
   - Never commit API keys, tokens, or credentials.
   - Mask internal errors and sanitize user inputs using Zod schemas.
   - Ensure all new API endpoints have corresponding test coverage in `server/test/`.
