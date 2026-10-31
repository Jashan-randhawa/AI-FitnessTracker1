# 🤝 Contributing to FitTrack AI

We welcome contributions to FitTrack AI! To ensure consistency, reliability, and security across the platform, please review the following guidelines before opening a pull request.

---

## 📋 Pull Request & Documentation Checklist

When submitting a pull request, verify and check off the following items:

- [ ] **Tests Passing:** All unit, integration, and smoke tests pass locally (`npm test` in client and server, `npm run test:smoke` in server).
- [ ] **Coverage Thresholds:** New or changed server code has tests; coverage thresholds still pass (`npm run test:coverage` in server).
- [ ] **Documentation Sync:** **If I renamed, moved, or added an endpoint, environment variable, script, or file, I updated `docs/` and `docs/README.md` (index).**
- [ ] **README Size Boundary:** `README.md` remains a lean entry point and does not exceed **8 KB** (`npm run docs:check`).
- [ ] **Link Integrity:** All relative markdown links and anchors resolve cleanly without broken paths (`npm run docs:check`).
- [ ] **Security & Secrets:** No secrets, realistic API keys, tokens, or credentials are committed. Cryptographic secrets use `<placeholder>` values and follow generation recipes.
- [ ] **Error Masking:** Database exceptions and internal error traces are sanitized and never leaked to the client in production.

---

## 🛠️ Development Workflow

1. **Clone & Branch:**
   ```bash
   git clone https://github.com/Jashan-randhawa/AI-FitnessTracker1.git
   cd AI-FitnessTracker1
   git checkout -b feat/your-feature-name
   ```

2. **Install Dependencies:**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

3. **Verify Documentation Guardrails:**
   ```bash
   # From root directory
   npm run docs:check
   ```

4. **Verify Test Suites:**
   ```bash
   # Server (Node native test runner)
   cd server
   npm test
   npm run test:smoke

   # Client (Vitest)
   cd ../client
   npm test
   ```

5. **Commit Conventions:**
   Follow Conventional Commits:
   - `feat:` New user-facing or platform capability
   - `fix:` Bug fix or regression patch
   - `docs:` Documentation improvements or synchronization
   - `test:` Adding or expanding test coverage
   - `refactor:` Code restructuring without functional alterations

---

## 📖 Technical Documentation

For detailed architecture diagrams, endpoint schemas, and testing guidelines, consult the [Documentation Index](docs/README.md).
