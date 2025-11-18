/**
 * ESLint made breaking changes in 8.21.0 to address several shortcomings of the
 * ecosystem, in particular prior versions of ESLint required that when
 * extending configs, downstream projects must install all peer dependencies of
 * that extension themselves.
 *
 * For example, this package defines a base config with several plugins. Prior
 * to 8.21.0 it would be the responsibility of downstream packages using this
 * config to also install those plugins.
 *
 * This behavior is fixed as of 8.21.0 with the introduction of Flat Configs
 * (see https://eslint.org/blog/2022/08/new-config-system-part-2/).
 *
 * However, we rely on the recommended config from.
 * `@typescript-eslint/eslint-plugin` which hasn't upgraded their plugin to
 * support flat configs. This file is a directy port of the recommended config
 * written using flat config syntax.
 */

const typescriptPlugin = require("@typescript-eslint/eslint-plugin");
const typescriptParser = require("@typescript-eslint/parser");

const extensions = require("../utils/extensions.cjs");

module.exports = [
  // @typescript-eslint/eslint-plugin configs['base']
  {
    files: extensions.all,
    languageOptions: {
      parser: typescriptParser,
      parserOptions: { sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
    },
  },

  // @typescript-eslint/eslint-plugin configs['eslint-recommended']
  {
    files: extensions.typescript,
    rules: {
      "constructor-super": "off",
      "getter-return": "off",
      "no-const-assign": "off",
      "no-dupe-args": "off",
      "no-dupe-class-members": "off",
      "no-dupe-keys": "off",
      "no-func-assign": "off",
      "no-import-assign": "off",
      "no-new-symbol": "off",
      "no-obj-calls": "off",
      "no-redeclare": "off",
      "no-setter-return": "off",
      "no-this-before-super": "off",
      "no-undef": "off",
      "no-unreachable": "off",
      "no-unsafe-negation": "off",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "valid-typeof": "off", // ts(2367)
    },
  },

  // @typescript-eslint/eslint-plugin configs['recommended']
  {
    files: extensions.all,
    rules: {
      "@typescript-eslint/adjacent-overload-signatures": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/ban-types": "error",
      "no-array-constructor": "off",
      "@typescript-eslint/no-array-constructor": "error",
      "no-empty-function": "off",
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/no-empty-interface": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-extra-non-null-assertion": "error",
      "no-extra-semi": "off",
      "@typescript-eslint/no-extra-semi": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "no-loss-of-precision": "off",
      "@typescript-eslint/no-loss-of-precision": "error",
      "@typescript-eslint/no-misused-new": "error",
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
      "@typescript-eslint/no-this-alias": "error",
      "@typescript-eslint/no-unnecessary-type-constraint": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-var-requires": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/prefer-namespace-keyword": "error",
      "@typescript-eslint/triple-slash-reference": "error",
    },
  },
];
