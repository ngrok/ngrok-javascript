#!/usr/bin/env node

/**
 *
 * Original version of this example can be found here:
 * https://github.com/neonexus/sails-react-bootstrap-webpack/blob/release/ngrok.js
 *
 */

/**
 * This is the file used to lift Sails, and start Ngrok.
 *
 * Run it via node: `node ngrok.js`
 * Run it directly: `./ngrok.js` (if file is marked as executable)
 */

const moduleLoader = require('sails/lib/hooks/moduleloader');
const path = require('path');
const rc = require('sails/accessible/rc');
const ngrok = require('@ngrok/ngrok');
const sails = require('sails');
const {spawn} = require('child_process');

// Load configuration the way Sails would.
moduleLoader({
    config: {
        environment: process.env.NODE_ENV || 'development',
        paths: {
            config: path.join(__dirname, 'config')
        }
    }
}).loadUserConfig((err, config) => {
    if (err) {
        console.error('');
        console.error('There was an issue loading user configuration:');
        console.error('');
        console.error(err);
        console.error('');

        return process.exit(1);
    }

    // Set Ngrok defaults. These can be overwritten in `config/ngrok.js` or `config/local.js`.
    // Basically, this is just a safety net, should one delete the `config/ngrok.js` file.
    config = {
        ngrok: {
            auth: process.env.NGROK_BASIC || undefined, // Basic auth for the Ngrok tunnel.
            token: process.env.NGROK_AUTHTOKEN || process.env.NGROK_TOKEN || undefined, // The Ngrok token for your account.
            domain: process.env.NGROK_DOMAIN || undefined, // The Ngrok domain to use.
            region: process.env.NGROK_REGION || undefined, // Defaults to Global.
            port: process.env.PORT || 4242 // The port to start Sails on.
        },
        ...config
    };

    ngrok.forward({
        addr: config.ngrok.port, // This is actually the port to we'll use for Sails. Ngrok will handle its own ports.
        authtoken: config.ngrok.token,
        basic_auth: config.ngrok.auth, // eslint-disable-line
        domain: config.ngrok.domain,
        region: config.ngrok.region,
        schemes: ['HTTPS']
    }).then((listener) => {
        let origins;
        const ngrokUrl = listener.url();

        // Add the Ngrok URL to our allowed origins.
        if (config.security && config.security.cors && config.security.cors.allowOrigins) {
            origins = [...config.security.cors.allowOrigins];

            if (!config.security.cors.allowOrigins.includes(ngrokUrl)) {
                origins.push(ngrokUrl);
            }
        } else {
            origins = [ngrokUrl];
        }

        // Start Sails with some configuration overrides.
        sails.lift({
            ...rc('sails'),
            port: config.ngrok.port,
            security: {
                cors: {
                    allowOrigins: origins
                }
            }
        }, (err) => {
            if (err) {
                console.error(err);

                return process.exit(1);
            }

            // Hurray! We are up and running!
        });
    }).catch((e) => {
        console.log('');
        console.log('There was an error starting the Ngrok tunnel. Here is the error:');
        console.log('');
        console.log(e.message);
        console.log('');
    });
});
