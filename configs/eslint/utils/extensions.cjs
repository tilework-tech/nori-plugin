/**
 * ESLint Config rules by default only impact the paths:
 *
 * ```
 * ['**\/*.js', '**\/*.cjs', '**\/*.mjs']
 * ```
 *
 * However, many of our rules should apply to typescript as well. This file
 * contains common lists of lint patterns for use in other rules.
 */

const typescript = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.vue"];
const javascript = ["**/*.js", "**/*.jsx", "**/*.mjs", "*.cjs", "**/*.vue"];

module.exports = {
  typescript,
  javascript,
  all: [...typescript, ...javascript],
};
