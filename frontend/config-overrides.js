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

    config.resolve.alias = {
        ...config.resolve.alias,
        '@ui': path.resolve(__dirname, 'src/Components/UI'),
        '@components': path.resolve(__dirname, 'src/Components'),
        '@pages': path.resolve(__dirname, 'src/Pages'),
        '@services': path.resolve(__dirname, 'src/Services'),
        '@types': path.resolve(__dirname, 'src/Types'),
        '@assets': path.resolve(__dirname, 'src/Assets'),
        '@theme': path.resolve(__dirname, 'src/Theme'),
        '@utils': path.resolve(__dirname, 'src/Utils'),
        '@api': path.resolve(__dirname, 'src/API'),
        '@state': path.resolve(__dirname, 'src/AppState'),
    };

    return config;
};
