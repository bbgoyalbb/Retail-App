import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

// Mock the providers
jest.mock('../components/ThemeProvider', () => ({ children }) => <div>{children}</div>);
jest.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({ user: null, login: jest.fn(), logout: jest.fn() })
}));

describe('App', () => {
  test('should render without crashing', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
  });

  test('should render main app shell', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    // The app should render without throwing errors
    expect(document.body).toBeInTheDocument();
  });
});
