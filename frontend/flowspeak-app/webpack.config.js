const webpack = require('@nativescript/webpack');

module.exports = (env) => {
  webpack.init(env);

  webpack.chainWebpack((config) => {
    // Fix: postcss-loader / jiti uses node: URI scheme which webpack 5 doesn't
    // handle by default. Add a fallback so those modules resolve correctly.
    config.resolve.alias
      .set('node:url',  require.resolve('url'))
      .set('node:util', require.resolve('util'))
      .set('node:vm',   require.resolve('vm-browserify'))
      .set('node:v8',   false)
      .set('node:path', require.resolve('path-browserify'));

    // Suppress postcss-loader entirely from the NativeScript XML/CSS pipeline
    // (NativeScript handles CSS on its own — postcss is not needed)
    config.module.rules.delete('css');
    config.module.rules.delete('scss');
    config.module.rules.delete('less');
  });

  return webpack.resolveConfig();
};
