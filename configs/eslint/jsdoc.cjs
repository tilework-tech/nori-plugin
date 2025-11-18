const jsdocPlugin = require("eslint-plugin-jsdoc");

const extensions = require("./utils/extensions.cjs");

module.exports = [
  {
    files: extensions.all,

    plugins: {
      jsdoc: jsdocPlugin,
    },

    rules: {
      "jsdoc/check-access": 1,
      "jsdoc/check-alignment": 1,
      "jsdoc/check-line-alignment": [
        1,
        "never",
        {
          tags: ["param", "throws", "returns", "return", "yields"],
          wrapIndent: "  ",
        },
      ],
      "jsdoc/check-param-names": 1,
      "jsdoc/check-property-names": 1,
      "jsdoc/check-tag-names": 1,
      "jsdoc/check-types": 1,
      "jsdoc/check-values": 1,
      "jsdoc/empty-tags": 1,
      "jsdoc/implements-on-classes": 1,
      "jsdoc/no-bad-blocks": 1,
      "jsdoc/no-defaults": 1,
      "jsdoc/no-multi-asterisks": 1,
      "jsdoc/no-types": 1,
      "jsdoc/require-asterisk-prefix": 1,
      "jsdoc/require-jsdoc": 1,
      "jsdoc/require-param": 1,
      "jsdoc/require-param-description": 1,
      "jsdoc/require-param-name": 1,
      "jsdoc/require-returns": 1,
      "jsdoc/require-returns-check": 1,
      "jsdoc/require-returns-description": 1,
      "jsdoc/require-throws": 1,
      "jsdoc/require-yields": 1,
      "jsdoc/require-yields-check": 1,
      "jsdoc/sort-tags": [
        1,
        {
          tagSequence: [
            { tags: ["summary", "typeSummary"] },
            { tags: ["desc", "description"] },
            { tags: ["param"] },
            { tags: ["throws"] },
            { tags: ["return", "returns", "yields"] },
          ],
          linesBetween: 1,
        },
      ],
      "jsdoc/valid-types": 1,
    },
  },
];
