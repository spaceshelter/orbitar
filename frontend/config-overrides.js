const path = require('path');

module.exports = function override(config, env) {
    config.output.publicPath = '//' + process.env.REACT_APP_ROOT_DOMAIN + '/';

    const serviceWorkerPath = path.join(__dirname, 'src/serviceWorker.ts');
    config.entry = {
        main: [config.entry],
        serviceWorker: { import: serviceWorkerPath, filename: 'service.js' }
    };

    const htmlWebpackPlugin = config.plugins.find(plugin => plugin.constructor.name === 'HtmlWebpackPlugin');
    htmlWebpackPlugin.userOptions.excludeChunks = ['serviceWorker'];

    return config;
}
