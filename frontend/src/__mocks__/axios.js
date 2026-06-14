const create = jest.fn(() => ({
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  },
  get: jest.fn((url) => {
    if (url === '/settings') {
      return Promise.resolve({ data: { article_types: ['Shirt', 'Pant'], addon_items: ['Buttons', 'Tie'] } });
    }
    return Promise.resolve({ data: {} });
  }),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
}));

module.exports = {
  __esModule: true,
  default: { create },
  create,
};
