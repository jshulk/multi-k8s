const keys = require("./keys");
const redis = require("redis");

let redisClient;
let subscriber;

(async () => {
  redisClient = await redis
    .createClient({
      socket: {
        host: keys.redisHost,
        port: keys.redisPort,
        reconnectStrategy: () => 1000,
      },
    })
    .on("error", (err) => console.error(err))
    .connect();

  subscriber = redisClient.duplicate();
  await subscriber.connect();
  await subscriber.subscribe("insert", async (message, channel) => {
    console.log("insert channel called", message, channel);
    if (channel === "insert") {
      const value = parseInt(message, 10);
      const fibValue = fib(value);
      await redisClient.hSet("values", message, fibValue);
    }
  });
})();

function fib(index) {
  if (index < 2) {
    return 1;
  } else {
    return fib(index - 1) + fib(index - 2);
  }
}
