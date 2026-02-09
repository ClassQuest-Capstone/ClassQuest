#!/usr/bin/env node
/**
 * Test script to debug class code validation
 * Usage: node test-class-validation.js [JOIN_CODE]
 */

const API_URL = process.env.VITE_API_URL || "https://2xcb84ws5b.execute-api.ca-central-1.amazonaws.com";

async function testValidation(joinCode) {
  console.log("\n=== Testing Class Code Validation ===\n");
  console.log("Join Code:", joinCode);
  console.log("API URL:", API_URL);
  console.log("Endpoint:", `${API_URL}/classes/join/${joinCode.toUpperCase()}`);

  try {
    const response = await fetch(`${API_URL}/classes/join/${joinCode.toUpperCase()}`);

    console.log("\nResponse Status:", response.status, response.statusText);
    console.log("Response Headers:", Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log("\nResponse Body (raw):", text);

    if (text) {
      try {
        const data = JSON.parse(text);
        console.log("\nResponse Body (parsed):", JSON.stringify(data, null, 2));

        if (response.ok) {
          console.log("\n✅ SUCCESS: Class found!");
          console.log("   Class ID:", data.class_id);
          console.log("   Name:", data.name);
          console.log("   Join Code:", data.join_code);
          console.log("   Is Active:", data.is_active);
          console.log("   School ID:", data.school_id);
        } else {
          console.log("\n❌ FAILED: Class not found or error");
          console.log("   Error:", data.error);
        }
      } catch (e) {
        console.log("\n⚠️  Could not parse response as JSON");
      }
    }
  } catch (err) {
    console.error("\n❌ Request failed:", err.message);
  }
}

// Get join code from command line or use default
const joinCode = process.argv[2];

if (!joinCode) {
  console.error("Usage: node test-class-validation.js [JOIN_CODE]");
  console.error("Example: node test-class-validation.js ABC123");
  process.exit(1);
}

testValidation(joinCode);
