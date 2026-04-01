export default {
  routes: [
    // ── Step 1: Request a reset link ─────────────────────────────────────────
    {
      method:  'POST',
      path:    '/password-reset/request',
      handler: 'password-reset.request',
      config: {
        auth:        false, // public — no JWT required
        middlewares: [],
        policies:    [],
      },
    },

    // ── Step 1.5: Pre-validate a token (optional — called on page load) ───────
    {
      method:  'GET',
      path:    '/password-reset/validate',
      handler: 'password-reset.validate',
      config: {
        auth:        false,
        middlewares: [],
        policies:    [],
      },
    },

    // ── Step 2: Submit new password with the token ────────────────────────────
    {
      method:  'POST',
      path:    '/password-reset/reset',
      handler: 'password-reset.reset',
      config: {
        auth:        false,
        middlewares: [],
        policies:    [],
      },
    },
  ],
};
