import { defineConfig } from "vitest/config";

export default defineConfig({
  // Automatic JSX runtime for rendered-component tests (*.test.tsx), matching
  // `"jsx": "react-jsx"` in tsconfig.json.
  esbuild: { jsx: "automatic" },
  test: {
    // Node stays the default so the existing logic/integration tests run
    // exactly as before. Rendered-component tests opt into a DOM per file
    // with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
