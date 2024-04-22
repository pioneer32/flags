/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.\\.?\\/.+)\\.jsx?$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  preset: 'ts-jest/presets/default-esm',
  setupFilesAfterEnv: [],
  transformIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/../node_modules/'],
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.[jt]s'],
  automock: false,
};
