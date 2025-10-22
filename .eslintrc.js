module.exports = {
  extends: ["airbnb-base"],
  env: {
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
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
