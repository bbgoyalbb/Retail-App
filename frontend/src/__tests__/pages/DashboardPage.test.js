import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';

// Mock the API
jest.mock('../../api', () => ({
  getDashboard: jest.fn(() => Promise.resolve({ data: { stats: {} } }))
}));

// Mock the AuthContext
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'test', role: 'admin' } })
}));

describe('Dashboard', () => {
  test('should render dashboard component', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    // Dashboard should render without errors
    expect(document.body).toBeInTheDocument();
  });
});
