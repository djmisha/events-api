module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  extends: ["airbnb-base"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  overrides: [
    {
      files: ["**/*.ts"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: ["airbnb-base"],
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
      },
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
        "no-unused-vars": "off",
        "import/extensions": "off",
        "import/no-unresolved": "off",
        "import/prefer-default-export": "off",
        quotes: "off",
        "comma-dangle": "off",
        "operator-linebreak": "off",
        indent: "off",
        "lines-between-class-members": "off",
        "no-underscore-dangle": "off",
        "consistent-return": "off",
        "no-use-before-define": "off",
        "no-await-in-loop": "off",
      },
    },
  ],
  rules: {
    "no-console": "off",
    quotes: ["error", "double"],
    "no-underscore-dangle": "off",
    "consistent-return": "off",
    "no-use-before-define": "off",
    "no-plusplus": "off",
    "global-require": "off",
    "comma-dangle": "off",
    "operator-linebreak": "off",
    indent: "off",
  },
};
