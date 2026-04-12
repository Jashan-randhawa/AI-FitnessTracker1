export default {
  routes: [
    { method: 'GET',    path: '/waterlogs',     handler: 'waterlog.find'   },
    { method: 'POST',   path: '/waterlogs',     handler: 'waterlog.create' },
    { method: 'DELETE', path: '/waterlogs/:id', handler: 'waterlog.delete' },
  ],
};
