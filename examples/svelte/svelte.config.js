import adapter from '@sveltejs/adapter-auto';

// setup ngrok ingress
import ngrok from '@ngrok/ngrok';
var host = 'localhost';
var port = '5173';
process.argv.forEach((item, index) => {
  if (item == '--host') host = process.argv[index+1];
  if (item == '--port') port = process.argv[index+1];
});
new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect().then((session) => {
  session.httpEndpoint().listen().then((tunnel) => {
    console.log(`Forwarding to: ${host}:${port} from ingress at: ${tunnel.url()}`);
    tunnel.forwardTcp(`${host}:${port}`);
  });
});

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
		// If your environment is not supported or you settled on a specific environment, switch out the adapter.
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter()
	}
};

export default config;
