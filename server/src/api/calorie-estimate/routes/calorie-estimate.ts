export default {
  routes: [
    {
      method: "POST",
      path: "/calorie-estimate",
      handler: "calorie-estimate.estimate",
      config: {
        auth: false,
      },
    },
  ],
};
