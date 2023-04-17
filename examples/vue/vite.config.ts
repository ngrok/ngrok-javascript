import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

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

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
