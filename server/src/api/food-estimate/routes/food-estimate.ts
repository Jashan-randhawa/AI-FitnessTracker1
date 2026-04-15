export default {
  routes: [
    {
      method: "POST",
      path: "/food-estimate",
      handler: "food-estimate.estimate",
      config: {
        auth: true,
      },
    },
  ],
};
