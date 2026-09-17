export function hasAnimalFormErrors(
  errors: Record<string, string | undefined>,
) {
  return Object.values(errors).some(Boolean);
}
