
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    test: {
        environment: "node",
        globals: false,
        root: __dirname,
        include: ["src/**/__tests__/**/*.test.ts"],
    },
});




// old way
// import { defineConfig } from "vitest/config";
// import path from "path";

// export default defineConfig({
//     test: {
//         environment: "node",
//         globals: false,
//         root: path.resolve(__dirname),
//         include: ["src/**/__tests__/**/*.test.ts"],
//     },
// });
