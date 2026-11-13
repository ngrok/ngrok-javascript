// configuration for axios-retry
export const retryConfig = {
  retries: 3, // number of retries
  retryDelay: (retryCount) => {
    return retryCount * 2000; // time interval between retries
  },
  retryCondition: (error) => {
    // A TCP endpoint refuses connections until ngrok routes it, as an HTTP
    // endpoint answers 404 until then.
    if (error.code === "ECONNREFUSED") {
      return true;
    }
    // if retry condition is not specified, by default idempotent requests are retried
    if (!error.hasOwnProperty("response")) {
      return false;
    }
    return error.response.status === 404 || error.response.status >= 500;
  },
};
