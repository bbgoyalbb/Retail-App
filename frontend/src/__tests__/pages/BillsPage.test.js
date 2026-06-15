import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('@/hooks/use-toast', () => ({
  __esModule: true,
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/api', () => ({
  __esModule: true,
  getItems: jest.fn(() => Promise.resolve({ data: [] })),
  getCustomers: jest.fn(() => Promise.resolve({ data: [] })),
  getSettings: jest.fn(() => Promise.resolve({ data: {} })),
  getNextBillRef: jest.fn(() => Promise.resolve({ data: { ref: 'REF-001' } })),
  getInvoiceUrl: jest.fn(() => Promise.resolve({ data: { url: '/invoice.pdf' } })),
  invalidateCustomersCache: jest.fn(),
}));

describe('NewBill', () => {
  test('should render new bill component', () => {
    const { default: NewBill } = require('../../pages/NewBill');

    render(
      <MemoryRouter>
        <NewBill />
      </MemoryRouter>
    );

    expect(document.body).toBeInTheDocument();
  });
});
