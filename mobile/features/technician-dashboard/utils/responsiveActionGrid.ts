export const getQuickActionGridMetrics = (width: number) => {
  const screenPadding = width <= 320 ? 16 : width <= 360 ? 20 : 24;
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const gap = width <= 320 ? 12 : 16;
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

