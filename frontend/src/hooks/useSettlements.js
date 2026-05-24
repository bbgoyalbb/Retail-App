import { useState, useEffect, useCallback } from 'react';
import { getBalances, processSettlement } from '@/api';
import { useToast } from './use-toast';

/**
 * Custom hook for managing settlements data
 * @param {Object} params - Query parameters for filtering settlements
 * @returns {Object} Settlements data, loading state, error, and operations
 */
export function useSettlements(params = {}) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getBalances(params);
      setBalances(response.data || []);
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error',
        description: 'Failed to load settlement balances',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [params, toast]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const settle = useCallback(
    async (data) => {
      try {
        await processSettlement(data);
        toast({
          title: 'Success',
          description: 'Settlement processed successfully',
        });
        await fetchBalances();
        return true;
      } catch (err) {
        toast({
          title: 'Error',
          description: err.message || 'Failed to process settlement',
          variant: 'destructive',
        });
        return false;
      }
    },
    [fetchBalances, toast]
  );

  return { balances, loading, error, settle, refetch: fetchBalances };
}
