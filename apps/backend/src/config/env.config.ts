export default () => ({
  port: parseInt(process.env.PORT!, 10),
  mongoUri: process.env.MONGO_URI,
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10),
  },
  aws: {
    s3Bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    cloudFrontKeyPairId: process.env.AWS_CLOUDFRONT_KEY_PAIR_ID,
    cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
  },
});
