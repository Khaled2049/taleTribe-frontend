export function withSelectionParam(
  params: URLSearchParams,
  key: string,
  id: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (id) next.set(key, id);
  else next.delete(key);
  return next;
}
