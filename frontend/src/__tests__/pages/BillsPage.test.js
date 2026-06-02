import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NewBill from '../../pages/NewBill';

// Mock the API
jest.mock('../../api', () => ({
  getItems: jest.fn(() => Promise.resolve({ data: [] })),
  getCustomers: jest.fn(() => Promise.resolve({ data: [] }))
}));

// Mock the AuthContext
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'test', role: 'admin' } })
}));

describe('NewBill', () => {
  test('should render new bill component', () => {
    render(
      <BrowserRouter>
        <NewBill />
      </BrowserRouter>
    );
    // NewBill should render without errors
    expect(document.body).toBeInTheDocument();
  });
});
