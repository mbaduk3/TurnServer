module.exports = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  modulePathIgnorePatterns: ['tests/utils/*'],
  coveragePathIgnorePatterns: ['tests/utils/*'],
  reporters: [
    "default",
    ["./node_modules/jest-html-reporter", {
      pageTitle: "Test Report",
      // includeConsoleLog: true,
      includeConsoleLog: false,
      includeFailureMsg: true,
      // includeFailureMsg: false,
    }],
  ]
};