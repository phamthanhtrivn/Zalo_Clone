export default () => ({
  port: parseInt(process.env.PORT!, 10),
  mongoUri: process.env.MONGO_URI,
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
  },
});
