export default {
  routes: [
    {
      method: 'POST',
      path:   '/password-reset/request',
      handler: 'password-reset.request',
      config: {
        auth: false,       // public — no JWT needed
        middlewares: [],
        policies: [],
      },
    },
    {
      method: 'POST',
      path:   '/password-reset/reset',
      handler: 'password-reset.reset',
      config: {
        auth: false,
        middlewares: [],
        policies: [],
      },
    },
  ],
};
