/**
 * Convert order_index to zero-padded order_key for boss questions
 * Used for sorting questions in DynamoDB GSI1
 *
 * @param order_index - Numeric order (0-based)
 * @returns Zero-padded 6-digit string (e.g., 0 → "000000", 42 → "000042")
 *
 * @example
 * makeOrderKey(0)      // "000000"
 * makeOrderKey(42)     // "000042"
 * makeOrderKey(9999)   // "009999"
 * makeOrderKey(999999) // "999999"
 */
export function makeOrderKey(order_index: number): string {
    if (order_index < 0) {
        throw new Error("order_index must be non-negative");
    }
    if (order_index > 999999) {
        throw new Error("order_index must be <= 999999");
    }
    return String(order_index).padStart(6, "0");
}
