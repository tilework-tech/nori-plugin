/**
 * ESLint flat config describing our desired import order.
 *
 * See https://docs.google.com/document/d/1h0fZ3s0mhc6ulXmHRB7RrsTN6p9_IoYuH99JWenLirI/edit#heading=h.jbzuwoglhga4
 */

const importPlugin = require("eslint-plugin-import");

const extensions = require("./utils/extensions.cjs");

module.exports = [
  {
    files: extensions.all,
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "type"],

          // eslint-plugin-import identifies internal vs. extenal imports by
          // inspecting the local file system. This presents an issue with
          // generated code because unless we've actually built the project,
          // those files may not exist leading to incorrectly identifying
          // generated code as external. Whereas once we build, we'd identify
          // the same files as internal. Making lint inconsistent based on the
          // developer's environment. To solve this, we move generated files
          // (identified by the prefix @generated/) to their own import block.)
          pathGroups: [
            {
              pattern: "@generated/**",
              group: "unknown",
            },
          ],
          pathGroupsExcludedImportTypes: [],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
    settings: {
      "import/external-module-folders": ["node_modules"],
      "import/resolver": {
        typescript: {},
      },
    },
  },
];
