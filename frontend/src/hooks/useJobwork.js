import { useState, useEffect, useCallback } from 'react';
import { getJobwork, invalidateJobworkCache, moveJobwork, moveJobworkBack, moveJobworkEmb, editJobworkEmb } from '@/api';
import { useToast } from './use-toast';

/**
 * Custom hook for managing jobwork data
 * @param {Object} params - Query parameters for filtering jobwork
 * @returns {Object} Jobwork data, loading state, error, and operations
 */
export function useJobwork(params = {}) {
  const [jobwork, setJobwork] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const fetchJobwork = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getJobwork(params);
      setJobwork(response.data || []);
    } catch (err) {
      setError(err.message);
      toast({
        title: 'Error',
        description: 'Failed to load jobwork',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [params, toast]);

  useEffect(() => {
    fetchJobwork();
  }, [fetchJobwork]);

  const moveForward = useCallback(
    async (data) => {
      try {
        await moveJobwork(data);
        toast({
          title: 'Success',
          description: 'Jobwork moved successfully',
        });
        await fetchJobwork();
        return true;
      } catch (err) {
        toast({
          title: 'Error',
          description: err.message || 'Failed to move jobwork',
          variant: 'destructive',
        });
        return false;
      }
    },
    [fetchJobwork, toast]
  );

  const moveBackward = useCallback(
    async (data) => {
      try {
        await moveJobworkBack(data);
        toast({
          title: 'Success',
          description: 'Jobwork moved back successfully',
        });
        await fetchJobwork();
        return true;
      } catch (err) {
        toast({
          title: 'Error',
          description: err.message || 'Failed to move jobwork back',
          variant: 'destructive',
        });
        return false;
      }
    },
    [fetchJobwork, toast]
  );

  const moveEmbroidery = useCallback(
    async (data) => {
      try {
        await moveJobworkEmb(data);
        toast({
          title: 'Success',
          description: 'Embroidery moved successfully',
        });
        await fetchJobwork();
        return true;
      } catch (err) {
        toast({
          title: 'Error',
          description: err.message || 'Failed to move embroidery',
          variant: 'destructive',
        });
        return false;
      }
    },
    [fetchJobwork, toast]
  );

  const editEmbroidery = useCallback(
    async (data) => {
      try {
        await editJobworkEmb(data);
        toast({
          title: 'Success',
          description: 'Embroidery edited successfully',
        });
        await fetchJobwork();
        return true;
      } catch (err) {
        toast({
          title: 'Error',
          description: err.message || 'Failed to edit embroidery',
          variant: 'destructive',
        });
        return false;
      }
    },
    [fetchJobwork, toast]
  );

  return {
    jobwork,
    loading,
    error,
    moveForward,
    moveBackward,
    moveEmbroidery,
    editEmbroidery,
    refetch: fetchJobwork,
  };
}
