export const getQuickActionGridMetrics = (width: number) => {
  const screenPadding = width >= 600 ? 24 : 16;
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const gap = width >= 600 ? 16 : 12;
  const containerWidth = Math.min(width - screenPadding * 2, 720);
  const cardPadding = 16;
  const itemWidth =
    (containerWidth - cardPadding * 2 - gap * (columns - 1)) / columns;
  return {
    screenPadding,
    columns,
    gap,
    itemWidth,
    iconSize: width <= 390 ? 54 : 56,
  };
};

