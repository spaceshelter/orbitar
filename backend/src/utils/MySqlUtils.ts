
export function escapePercent(str: string): string {
    return str.replace(/%/g, '\\%');
}
