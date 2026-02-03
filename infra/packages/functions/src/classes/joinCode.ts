import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure random join code
 * Uses uppercase alphanumeric characters (A-Z, 0-9)
 * 36^6 = 2,176,782,336 possible combinations
 *
 * @param length - Length of join code (default 6)
 * @returns Uppercase alphanumeric join code
 */
export function generateJoinCode(length: number = 6): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const charsLength = chars.length;

    // Generate enough random bytes (use more than needed for better distribution)
    const bytes = randomBytes(length * 2);

    let result = "";
    for (let i = 0; i < length; i++) {
        // Use modulo to map byte value to character index
        const randomIndex = bytes[i] % charsLength;
        result += chars[randomIndex];
    }

    return result;
}
