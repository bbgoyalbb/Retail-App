import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage';

// Mock the API
jest.mock('../../api', () => ({
  login: jest.fn()
}));

// Mock the AuthContext
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn() })
}));

describe('LoginPage', () => {
  test('should render login form', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  test('should have submit button', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });
});
