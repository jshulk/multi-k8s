const keys = require("./keys");
//Express app setup
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(bodyParser.json());

//Postgres client setup
const { Pool } = require("pg");
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
  ssl:
    process.env.NODE_ENV != "production"
      ? false
      : { rejectUnauthorized: false },
});
pgClient.on("error", () => console.log("lost pg connection"));
pgClient.on("connect", (client) => {
  client
    .query("CREATE TABLE IF NOT EXISTS values(number INT)")
    .catch((err) => console.log(err));
});

//Redis client setup
let redisClient;
let redisPublisher;
(async () => {
  const redis = require("redis");
  redisClient = await redis
    .createClient({
      socket: {
        host: keys.redisHost,
        port: keys.redisPort,
        reconnectStrategy: () => 1000,
      },
    })
    .connect();
  redisPublisher = redisClient.duplicate();
  await redisPublisher.connect();
})();

app.get("/", (req, res) => {
  res.send("Hi");
});
app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * FROM values");
  res.send(values.rows);
});
app.get("/values/current", async (req, res) => {
  const values = await redisClient.hGetAll("values");
  console.log("values fetchd from redis", values);
  res.send(values);
});

app.post("/values", async (req, res) => {
  const index = req.body.index;
  if (parseInt(index) > 40) {
    return res.status(422).send("Index too high");
  }
  redisClient.hSet("values", index, "Nothing yet");
  await redisPublisher.publish("insert", index);
  pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);
  res.send({ working: true });
});

app.listen(5001, () => console.log("Listening"));
