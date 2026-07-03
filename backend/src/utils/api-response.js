export const sendList = (res, { data, page = 1, limit = data.length, total = data.length }) =>
  res.status(200).json({ data, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

export const sendDetail = (res, data, status = 200) => res.status(status).json({ data });

export const sendMutation = (res, message, data, status = 200) => res.status(status).json({ message, data });
