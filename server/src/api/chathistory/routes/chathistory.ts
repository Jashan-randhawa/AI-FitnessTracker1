export default {
  routes: [
    { method: 'GET',    path: '/chathistories',        handler: 'chathistory.find'      },
    { method: 'POST',   path: '/chathistories',        handler: 'chathistory.create'    },
    { method: 'DELETE', path: '/chathistories/all',    handler: 'chathistory.deleteAll' },
  ],
};
