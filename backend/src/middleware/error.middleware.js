export const notFound = (req, res) => res.status(404).json({ message: "Route not found", code: "NOT_FOUND" });

export const errorHandler = (error, req, res, next) => {
  console.error("[API ERROR]", error);
  res.status(error.status || 500).json({
    message: error.message || "Internal server error",
    code: error.code || "INTERNAL_ERROR",
    ...(error.details ? { details: error.details } : {}),
  });
};
