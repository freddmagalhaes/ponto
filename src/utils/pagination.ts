/** Follow the returned row count even when the API enforces a smaller page size. */
export async function fetchAllPages<T>(fetchPage: (offset: number, size: number) => Promise<{ data: T[]; count: number | null }>, size = 200): Promise<T[]> {
  const records: T[] = [];
  let count: number | null = null;
  while (true) {
    const page = await fetchPage(records.length, size);
    count = page.count ?? count;
    if (!page.data.length) break;
    records.push(...page.data);
    if (count !== null && records.length >= count) break;
  }
  return records;
}
