export function assertNotNull<T>(value: T|null): T {
  if (value === null) {
    throw new Error(`Assertion failure!`);
  }
  return value;
}

export function assertNullOrInt(value: string|null): number|null {
  if (value === null) return null;
  const num = parseInt(value);
  if (isNaN(num)) {
    throw new Error(`${value} is not a number!`);
  }
  return num;
}

export function getPositiveInt(value: string): number {
  const num = parseInt(value);
  if (isNaN(num) || num <= 0) {
    throw new Error(`'${value}' must be a positive integer!`);
  }
  return num;
}
