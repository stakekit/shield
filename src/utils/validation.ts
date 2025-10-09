export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value !== '';
};

export const isNullOrUndefined = (
  value: unknown,
): value is null | undefined => {
  return value === null || value === undefined;
};

export const isDefined = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};
