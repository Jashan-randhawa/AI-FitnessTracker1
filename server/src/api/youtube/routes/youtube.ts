export default {
  routes: [
    {
      method: 'GET',
      path: '/youtube/search',
      handler: 'youtube.search',
      config: {
        auth: false,
      },
    },
  ],
};
