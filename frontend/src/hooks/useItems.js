import { useState, useEffect, useCallback } from 'react';
import { getItems, invalidateItemsCache } from '@/api';
import { useToast } from './use-toast';

/**
 * Custom hook for managing items/orders data
 * @param {Object} params - Query parameters for filtering items
 * @returns {Object} Items data, loading state, error, and refetch function
 */
export function useItems(params = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getItems(params);
      setItems(response.data || []);
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error',
        description: 'Failed to load items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [params, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const refetch = useCallback(() => {
    invalidateItemsCache();
    fetchItems();
  }, [fetchItems]);

  return { items, loading, error, refetch };
}
