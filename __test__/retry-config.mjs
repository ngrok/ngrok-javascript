// configuration for axios-retry
export const retryConfig = {
  retries: 3, // number of retries
  retryDelay: (retryCount) => {
    console.log(`axios retry attempt: ${retryCount}`);
    return retryCount * 2000; // time interval between retries
  },
  retryCondition: (error) => {
    // if retry condition is not specified, by default idempotent requests are retried
    if (!error.hasOwnProperty("response")) {
      return false;
    }
    return error.response.status === 404 || error.response.status >= 500;
  },
};
