const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = function override(config, env) {
    config.output.publicPath = '//' + process.env.REACT_APP_ROOT_DOMAIN + '/';

    const serviceWorkerPath = path.join(__dirname, 'src/serviceWorker.ts');
    config.entry = {
        main: [config.entry],
        serviceWorker: { import: serviceWorkerPath, filename: 'service.js' }
    };

    const htmlWebpackPlugin = config.plugins.find(plugin => plugin.constructor.name === 'HtmlWebpackPlugin');
    htmlWebpackPlugin.userOptions.excludeChunks = ['serviceWorker'];

    if (env === 'development') {
        config.plugins.push(new MiniCssExtractPlugin());
    }

    config.module.rules[1].oneOf = [
        {
            test: /\.font\.js/,
            use: [
                {loader: MiniCssExtractPlugin.loader},
                {loader: 'css-loader', options: { url: false}},
                {loader: 'webfonts-loader'}
            ]
        },
        ...config.module.rules[1].oneOf
    ];

    return config;
};
