const path = require('path');

module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-router-dom$': '<rootDir>/../node_modules/react-router-dom/dist/index.js',
    '^react-router/dom$': '<rootDir>/../node_modules/react-router/dist/development/dom-export.js',
    '^react-router$': '<rootDir>/../node_modules/react-router/dist/development/index.js',
  },
  moduleDirectories: ['node_modules', path.resolve(__dirname, '..', 'node_modules')],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx}',
  ],
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
};
