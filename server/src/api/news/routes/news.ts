export default {
  routes: [
    {
      method: 'GET',
      path: '/news/headlines',
      handler: 'api::news.news.getHeadlines',
      config: {
        auth: {
          scope: ['api::news.news.getHeadlines'],
        },
      },
    },
  ],
};
