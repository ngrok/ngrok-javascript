const ngrok = require('@ngrok/ngrok');
// const ngrok = require('..'); // relative path is needed from a repository build

module.exports = async (phase, { defaultConfig }) => {
  /**
   * @type {import('next').NextConfig}
   */
  const nextConfig = {
    /* config options here */
  }

  // setup ngrok ingress in the parent process
  var makeTunnel = true;
  var host = 'localhost';
  var port = '3000';
  process.argv.forEach((item, index) => {
    if (item.includes('processChild')) makeTunnel = false;
    if (['--hostname', '-H'].includes(item)) host = process.argv[index+1];
    if (['--port', '-p'].includes(item)) port = process.argv[index+1];
  });
  if (makeTunnel) {
    const session = await new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect();
    const tunnel = await session.httpEndpoint().listen();
    console.log(`Forwarding to: ${host}:${port} from ingress at: ${tunnel.url()}`);
    tunnel.forwardTcp(`${host}:${port}`);
  }

  return nextConfig
}
