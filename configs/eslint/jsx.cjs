/**
 * Supports jsx parsing.
 */

module.exports = [
  {
    files: ["**/*.jsx", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        jsx: true,
        useJSXTextNode: true,
      },
    },
  },
];
