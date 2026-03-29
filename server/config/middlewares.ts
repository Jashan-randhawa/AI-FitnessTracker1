import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: (requestOrigin, callback) => {
        // Allow non-browser / same-origin requests without an Origin header
        if (!requestOrigin) {
          return callback(null, true);
        }

        const allowedOrigins = new Set([
          'http://localhost:5173',
          'http://localhost:3000',
          'https://ai-fitness-tracker1-hhwzrects.vercel.app',
        ]);

        const isPreviewDeployment = /^https:\/\/ai-fitness-tracker1(?:-[a-z0-9]+)?\.vercel\.app$/.test(
          requestOrigin
        );

        return callback(null, allowedOrigins.has(requestOrigin) || isPreviewDeployment);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
