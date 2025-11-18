const eslint = require("./eslint/index.cjs");
const prettier = require("./prettier/index.cjs");

module.exports = {
  eslint: eslint.default,
  prettier,
};
