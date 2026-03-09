module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: ['**/*.js', '!**/node_modules/**', '!**/coverage/**'],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['js', 'json', 'node'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
};
