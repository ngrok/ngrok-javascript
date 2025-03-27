/**
 * Local environment settings
 *
 * For more information, check out:
 * https://sailsjs.com/docs/concepts/configuration/the-local-js-file
 */

module.exports = {
    // Configuration options for ngrok.js script.
    ngrok: {
        // auth: 'username:notSoSecretPassword', // Uncomment to set a basic-auth user/password for the Ngrok tunnel. Password must be between 8 and 128 characters.
        domain: 'my-ngrok-app.ngrok-free.app',
        token: '{{my_ngrok_token_here}}',
        port: 4242 // This sets Sails' port when running `ngrok.js`.
    },

    // The port to attach the API to. This does NOT affect the `ngrok.js` script.
    port: 1337,
};
