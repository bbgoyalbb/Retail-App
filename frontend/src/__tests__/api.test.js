import api, { 
  BACKEND_URL, 
  getDashboard, 
  invalidateDashboardCache,
  getCustomers,
  login,
  getInvoiceUrl
} from '../api';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    },
    get: jest.fn(),
    post: jest.fn()
  }))
}));

describe('API Configuration', () => {
  test('BACKEND_URL should use window.location.origin when no env var', () => {
    expect(BACKEND_URL).toBe(window.location.origin);
  });
});

describe('Dashboard API', () => {
  beforeEach(() => {
    invalidateDashboardCache();
  });

  test('getDashboard should cache results', async () => {
    const mockResponse = { data: { stats: {} } };
    api.get = jest.fn().mockResolvedValue(mockResponse);
    
    const result1 = await getDashboard();
    const result2 = await getDashboard();
    
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(mockResponse);
    expect(result2).toEqual(mockResponse);
  });

  test('getDashboard with force=true should bypass cache', async () => {
    const mockResponse = { data: { stats: {} } };
    api.get = jest.fn().mockResolvedValue(mockResponse);
    
    await getDashboard(true);
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe('Auth API', () => {
  test('login should return user data with token', async () => {
    const mockResponse = { 
      data: { 
        token: 'test-token',
        user: { username: 'test', role: 'admin' }
      }
    };
    api.post = jest.fn().mockResolvedValue(mockResponse);
    
    const result = await login('test', 'password');
    expect(result.token).toBe('test-token');
    expect(api.post).toHaveBeenCalledWith('/auth/login', { 
      username: 'test', 
      password: 'password' 
    });
  });
});
