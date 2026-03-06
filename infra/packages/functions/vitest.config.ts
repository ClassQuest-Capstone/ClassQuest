import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "node",
        globals: false,
        root: path.resolve(__dirname),
        include: ["src/**/__tests__/**/*.test.ts"],
    },
});
