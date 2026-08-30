export const getNextAdminRecordsPage = (
  currentPage: number,
  totalPages: number,
) => (currentPage < totalPages ? currentPage + 1 : currentPage);

export const getPreviousAdminRecordsPage = (currentPage: number) =>
  currentPage > 1 ? currentPage - 1 : currentPage;
