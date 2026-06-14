import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TailoringConfigurator } from '../../components/TailoringConfigurator';
import { AddOnConfigurator } from '../../components/AddOnConfigurator';

const settingsLoader = () => Promise.resolve({ data: { article_types: ['Shirt', 'Pant'], addon_items: ['Buttons', 'Tie'] } });

describe('Modal state preservation', () => {
  test('TailoringConfigurator preserves edited order number when same item IDs remain', async () => {
    const handleChange = jest.fn();
    const initialItems = [
      {
        id: 'item-1',
        barcode: 'A1',
        qty: 5,
        tailoring: {
          enabled: true,
          article_type: 'Shirt',
          embroidery_status: 'Not Required',
          order_no: '',
          delivery_date: ''
        }
      }
    ];

    const { rerender } = render(
      <TailoringConfigurator
        items={initialItems}
        onChange={handleChange}
        onSave={jest.fn()}
        onClose={jest.fn()}
        mode="create"
        customerName="Test Customer"
        settingsLoader={settingsLoader}
      />
    );

    await waitFor(() => expect(screen.getByLabelText('Order number for A1')).toBeInTheDocument());

    const orderInput = screen.getByLabelText('Order number for A1');
    fireEvent.change(orderInput, { target: { value: '801' } });
    expect(orderInput.value).toBe('801');

    rerender(
      <TailoringConfigurator
        items={[
          {
            id: 'item-1',
            barcode: 'A1',
            qty: 6,
            tailoring: {
              enabled: true,
              article_type: 'Shirt',
              embroidery_status: 'Not Required',
              order_no: '',
              delivery_date: ''
            }
          }
        ]}
        onChange={handleChange}
        onSave={jest.fn()}
        onClose={jest.fn()}
        mode="create"
        customerName="Test Customer"
        settingsLoader={settingsLoader}
      />
    );

    expect(screen.getByLabelText('Order number for A1').value).toBe('801');
  });

  test('AddOnConfigurator preserves edited add-on price when same item IDs remain', async () => {
    const handleChange = jest.fn();
    const initialItems = [
      {
        id: 'item-1',
        barcode: 'B1',
        qty: 4,
        addon_desc: 'Buttons(100)'
      }
    ];

    const { rerender } = render(
      <AddOnConfigurator
        items={initialItems}
        onChange={handleChange}
        onSave={jest.fn()}
        onClose={jest.fn()}
        mode="create"
        customerName="Test Customer"
        settingsLoader={settingsLoader}
      />
    );

    await waitFor(() => expect(screen.getByPlaceholderText('0')).toBeInTheDocument());

    const priceInput = screen.getByPlaceholderText('0');
    fireEvent.change(priceInput, { target: { value: '150' } });
    expect(priceInput.value).toBe('150');

    rerender(
      <AddOnConfigurator
        items={[
          {
            id: 'item-1',
            barcode: 'B1',
            qty: 5,
            addon_desc: 'Buttons(100)'
          }
        ]}
        onChange={handleChange}
        onSave={jest.fn()}
        onClose={jest.fn()}
        mode="create"
        customerName="Test Customer"
        settingsLoader={settingsLoader}
      />
    );

    expect(screen.getByPlaceholderText('0').value).toBe('150');
  });
});
