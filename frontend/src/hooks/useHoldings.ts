import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getHoldings,
    createHolding,
    updateHolding,
    deleteHolding,
    reorderHoldings,
    type Holding,
    type HoldingInput,
} from '../api/client';

const HOLDINGS_KEY = ['holdings'];

export function useHoldings() {
    const qc = useQueryClient();

    const query = useQuery({
        queryKey: HOLDINGS_KEY,
        queryFn: getHoldings,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: HOLDINGS_KEY });

    const create = useMutation({
        mutationFn: (payload: Partial<HoldingInput> & { ticker: string }) => createHolding(payload),
        onSuccess: invalidate,
    });

    const update = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: Partial<HoldingInput> }) => updateHolding(id, payload),
        onSuccess: invalidate,
    });

    const remove = useMutation({
        mutationFn: (id: string) => deleteHolding(id),
        onSuccess: invalidate,
    });

    const reorder = useMutation({
        mutationFn: (ids: string[]) => reorderHoldings(ids),
        onSuccess: invalidate,
    });

    return {
        holdings: (query.data ?? []) as Holding[],
        isLoading: query.isLoading,
        error: query.error,
        create,
        update,
        remove,
        reorder,
    };
}
