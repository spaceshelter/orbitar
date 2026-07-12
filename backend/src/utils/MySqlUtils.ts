export function escapePercent(str: string): string {
  return str.replace(/%/g, '\\%')
}

// Escapes every character MySQL LIKE treats specially (%, _ and the escape
// character itself) so user input matches literally inside a LIKE pattern.
export function escapeLike(str: string): string {
  return str.replace(/[\\%_]/g, '\\$&')
}
