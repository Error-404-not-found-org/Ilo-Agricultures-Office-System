export const getPagination = (query, defaults = {}) => {
  const defaultLimit = defaults.defaultLimit || 10;
  const maxLimit = defaults.maxLimit || 50;

  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const requestedLimit = Number.parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(requestedLimit, 1), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const paginateArray = (items, { page, limit }) => {
  const total = items.length;
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};
