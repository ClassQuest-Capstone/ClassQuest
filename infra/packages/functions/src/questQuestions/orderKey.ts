/**
 * Convert order_index to zero-padded order_key
 * Used for sorting questions in DynamoDB GSI1
 *
 * @param order_index - Numeric order (1-based)
 * @returns Zero-padded 4-digit string (e.g., 1 → "0001", 42 → "0042")
 *
 * @example
 * toOrderKey(1)    // "0001"
 * toOrderKey(42)   // "0042"
 * toOrderKey(999)  // "0999"
 * toOrderKey(9999) // "9999"
 */
export function toOrderKey(order_index: number): string {
    if (order_index < 0) {
        throw new Error("order_index must be non-negative");
    }
    if (order_index > 9999) {
        throw new Error("order_index must be <= 9999");
    }
    return String(order_index).padStart(4, "0");
}
