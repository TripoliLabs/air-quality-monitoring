import { computed, type ComputedRef, type Ref, ref } from 'vue';

export interface SortState<K extends string> {
  key: Ref<K>;
  descending: Ref<boolean>;
  toggle: (key: K) => void;
  /** Sort by `key` in a given direction (for controls that are not column headers). */
  set: (key: K, descending: boolean) => void;
  ariaSort: (key: K) => 'ascending' | 'descending' | 'none';
}

/**
 * Sortable rows. Missing values always sink to the bottom, whichever way the
 * column is sorted, so sensors without data never crowd the top of a table.
 */
export function useSort<T, K extends string>(
  rows: () => T[],
  accessors: Record<K, (row: T) => number | string | null | undefined>,
  initial: K,
  initialDescending = false,
): SortState<K> & { sorted: ComputedRef<T[]> } {
  const key = ref(initial) as Ref<K>;
  const descending = ref(initialDescending);

  const sorted = computed(() => {
    const get = accessors[key.value];
    const direction = descending.value ? -1 : 1;
    return [...rows()].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const xMissing = x === null || x === undefined;
      const yMissing = y === null || y === undefined;
      if (xMissing || yMissing) return Number(xMissing) - Number(yMissing);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * direction;
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * direction;
    });
  });

  function toggle(next: K): void {
    if (key.value === next) descending.value = !descending.value;
    else {
      key.value = next;
      descending.value = false;
    }
  }

  function set(next: K, isDescending: boolean): void {
    key.value = next;
    descending.value = isDescending;
  }

  const ariaSort = (k: K): 'ascending' | 'descending' | 'none' =>
    key.value !== k ? 'none' : descending.value ? 'descending' : 'ascending';

  return { key, descending, sorted, toggle, set, ariaSort };
}
