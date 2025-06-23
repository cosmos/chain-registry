import json from "eslint-plugin-json";

export default [
  {
    files: ["./**/*.json"],
    ...json.configs["recommended"],
  },
];
