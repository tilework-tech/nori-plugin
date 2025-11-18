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
 * However, we rely on the vue3-recommended config from eslint-vue-plugin which
 * hasn't upgraded their plugin to support flat configs. This file is a directy
 * port of the recommended config written using flat config syntax.
 */

const typescriptParser = require("@typescript-eslint/parser");
const vuePlugin = require("eslint-plugin-vue");
const vueParser = require("vue-eslint-parser");

module.exports = [
  {
    files: ["**/*.vue"],

    languageOptions: {
      // We need to use the Vue parser to parse .vue files.
      parser: vueParser,
      parserOptions: {
        ...vuePlugin.configs.base.parserOptions,
        // Typescript is supported through the typescript parser. Since we're
        // using the Vue parser as our main parser, we need to signal it to use
        // the Typescript parser within the Vue parser. See
        // https://eslint.vuejs.org/user-guide/#what-is-the-use-the-latest-vue-eslint-parser-error
        parser: typescriptParser,
      },
      ecmaVersion: 6,
    },

    plugins: { vue: vuePlugin },

    // We have to manually compose these together because the Vue eslint plugin
    // still uses legacy config with `extends`, so the parser chokes if we just
    // include `vue3-recommended` directly here.
    rules: {
      ...vuePlugin.configs.base.rules,
      ...vuePlugin.configs["vue3-essential"].rules,
      ...vuePlugin.configs["vue3-strongly-recommended"].rules,
      ...vuePlugin.configs["vue3-recommended"].rules,
    },

    // Fix for mysterious "clear  vue/comment-directive" errors appearing
    // throughout the codebase. Based on
    // https://qiita.com/tashinoso/items/a72741ca8e2fd928ca77#comment-3e6cd674353056ecbb3a
    processor: vuePlugin.processors[".vue"],
  },
];
