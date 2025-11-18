/**
 * This file defines soot specific style lints.
 *
 * See https://go/style for more details.
 */

const extensions = require("./utils/extensions.cjs");

module.exports = [
  {
    files: extensions.all,
    rules: {
      // When selecting either T[] or Array<T> we've decided to prefer the
      // latter because it is more consistent in syntax with our other container
      // types (for example, Map<T>, Set<T>, Custom<T>).
      "@typescript-eslint/array-type": [
        "error",
        { default: "generic", readonly: "generic" },
      ],

      // Interfaces and types are not equivalent. Most notably, interfaces
      // support recursive structures with fewer constraints however they do not
      // support "index signature types". The result is that we cannot cast an
      // interface to something like `Record<string, any>` while types can. This
      // is because interfaces are considered mutable whereas types are static
      // by the compiler. For this reason we prefer types for their immutability
      // treatment.
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],

      // TypeScript allows specifying a type keyword on imports to indicate that
      // the export exists only in the type system, not at runtime. This allows
      // transpilers to drop imports without knowing the types of the
      // dependencies. At SOOT we always prefer using `import type` when
      // importing type symbols.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          disallowTypeAnnotations: true,
        },
      ],

      // An arbitrary decision to favor consistency, we use function expressions
      // which are more lightweight rather than function declarations.
      "func-style": ["error", "expression", { allowArrowFunctions: true }],

      // We adhere to the Google style guide which *does* allow inline bodies
      // for single line statements such as:
      //
      // ```ts
      // if (foo) return foo;
      // ```
      //
      // However, they also share that they only support this style to
      // historical legacy reasons and that new projects do not support inline
      // bodies. Here we disable all inline bodies.
      curly: ["error", "all"],

      // Prefer `const` instead of `let` when a variable is never modified.
      "prefer-const": "error",

      // Always prefer `let` over `var`.
      "no-var": "error",

      // Prevents the comma operator from being used to inline multiple
      // expressions into a single line.
      //
      // For example:
      //
      // ```ts
      // a = b += 5, a + b;
      // ```
      "no-sequences": "error",

      // Prevents escaping the multiline character in a file to create multiline
      // strings. Instead prefer to concatenate multiple strings together like
      // so:
      //
      // ```ts
      // const longText =
      //     "this is a really " +
      //     "really long line";
      // ```
      "no-multi-str": "error",

      // Prevents assigning multiple variables in a single expressions.
      //
      // See https://eslint.org/docs/latest/rules/no-multi-assign
      "no-multi-assign": "error",

      // Prevents blocks (bodies of code wrapped with curly brackets) which are
      // not part of control flow.
      //
      // See https://eslint.org/docs/latest/rules/no-lone-blocks
      "no-lone-blocks": "error",

      // Prevents if statements as the only statement in else blocks.
      //
      // See https://eslint.org/docs/latest/rules/no-lonely-if
      "no-lonely-if": "error",

      // Enforces that we use single-quotes unless backticks are required.
      //
      // See https://eslint.org/docs/latest/rules/quotes
      quotes: ["error", "single", { avoidEscape: true }],
    },
  },
];
