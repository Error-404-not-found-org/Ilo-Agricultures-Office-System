export function getDashboardWorkPreview<T>(items: T[]) {
  const previewItems = items.slice(0, 3);
  return {
    previewItems,
    total: items.length,
    hasMoreWork: items.length > previewItems.length,
  };
}
