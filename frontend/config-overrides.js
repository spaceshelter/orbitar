module.exports = function override(config, env) {
    config.output.publicPath = '//' + process.env.REACT_APP_ROOT_DOMAIN + '/';
    config.devServer = { port: 5000 };
    return config;
}
