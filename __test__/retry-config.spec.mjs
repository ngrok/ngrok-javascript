import axios from "axios";
import axiosRetry from "axios-retry";
import * as http from "http";
import * as retry from "./retry-config.mjs";

// A TCP endpoint refuses connections until ngrok routes it, so a request sent
// right after the listener is created can be refused; the online tests must
// retry it as they retry an HTTP endpoint's "offline" 404.
test("retry config retries a connection refused until the server listens", async () => {
  const server = http.createServer((req, res) => res.end("Hello"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));

  const client = axios.create();
  let refused = 0;
  // Registered before axios-retry, so it sees each failed attempt first: the
  // first refusal brings the server up for the retry.
  client.interceptors.response.use(undefined, (error) => {
    if (error.code === "ECONNREFUSED" && refused++ === 0) {
      server.listen(port, "127.0.0.1");
    }
    return Promise.reject(error);
  });
  axiosRetry(client, retry.retryConfig);

  try {
    const response = await client.get(`http://127.0.0.1:${port}/`);
    expect(refused).toBe(1);
    expect(response.data).toBe("Hello");
  } finally {
    server.close();
  }
});
