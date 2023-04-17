'use strict';

const Hapi = require('@hapi/hapi');
const ngrok = require('@ngrok/ngrok');

const init = async () => {
    const session = await new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect();
    const tunnel = await session.httpEndpoint().listen();
    console.log('Ingress at: ' + tunnel.url());
    tunnel.forwardTcp('localhost:3000');

    const server = Hapi.server({
        port: 3000,
        host: 'localhost'
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {

            return 'Hello World!';
        }
    });

    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {

    console.log(err);
    process.exit(1);
});

init();
