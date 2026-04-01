export default {
  routes: [
    {
      method: "POST",
      path: "/ai-assistant/chat",
      handler: "ai-assistant.chat",
      config: {
        auth: false,
      },
    },
  ],
};
