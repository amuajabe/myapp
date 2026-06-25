const express = require('express');
const fs = require('fs');
const yaml = require('yaml');
const redis = require('redis');
const app = express();
const config = yaml.parse(fs.readFileSync('./config/app-config.yml', 'utf8'));
const redisClient = redis.createClient({
url: `redis://${config.redis_host}:${config.redis_port}`
});
redisClient.connect().catch(console.error);
app.get('/', (req, res) => {
res.send(`App running. Env: ${config.app_env}`);
});
app.get('/health', (req, res) => {
res.status(200).send('OK');
});
app.listen(config.port || 3000, () => {
console.log(`Server running on port ${config.port || 3000}`);
});
module.exports = app;
