// craco.config.js - Performance optimization config
const path = require("path");

module.exports = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      // Add splitChunks optimization for vendor libraries
      if (!webpackConfig.optimization) {
        webpackConfig.optimization = {};
      }
      if (!webpackConfig.optimization.splitChunks) {
        webpackConfig.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              reuseExistingChunk: true,
            },
            recharts: {
              test: /[\\/]node_modules[\\/](recharts|d3|react-fast-compare)[\\/]/,
              name: 'vendor-recharts',
              priority: 20,
              reuseExistingChunk: true,
            },
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'vendor-radix',
              priority: 20,
              reuseExistingChunk: true,
            },
            phosphor: {
              test: /[\\/]node_modules[\\/]@phosphor-icons[\\/]/,
              name: 'vendor-phosphor',
              priority: 20,
              reuseExistingChunk: true,
            },
            dates: {
              test: /[\\/]node_modules[\\/](date-fns|react-day-picker)[\\/]/,
              name: 'vendor-dates',
              priority: 20,
              reuseExistingChunk: true,
            },
          },
        };
      }
      return webpackConfig;
    },
  },
  jest: {
    configure: {
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^react-router-dom$': path.resolve(__dirname, '..', 'node_modules', 'react-router-dom', 'dist', 'index.js'),
        '^react-router/dom$': path.resolve(__dirname, '..', 'node_modules', 'react-router', 'dist', 'development', 'dom-export.js'),
        '^react-router$': path.resolve(__dirname, '..', 'node_modules', 'react-router', 'dist', 'development', 'index.js'),
      },
      moduleDirectories: ['node_modules', path.resolve(__dirname, '..', 'node_modules')],
    },
  },
};
