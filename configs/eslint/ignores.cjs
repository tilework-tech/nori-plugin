/**
 * Ignores common files which should not be linted.
 */

module.exports = [
  {
    ignores: [
      "**/.rollup.cache/**",
      "**/.tmp/**",
      "**/.webpack/**",
      "**/.vite/**",
      "**/dist/**",
      "**/generated/**",
      "**/node_modules/**",
      "**/out/**",
    ],
  },
];
