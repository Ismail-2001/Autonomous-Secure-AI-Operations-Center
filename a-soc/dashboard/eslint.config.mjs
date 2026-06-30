import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('eslint').Linter.Config} */
const config = {
  root: true,
  extends: ["next/core-web-vitals"],
};

export default config;
