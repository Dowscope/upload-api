const config = require('./config');
const createApp = require('./app');

const app = createApp();
app.listen(config.api.port, () => {
  console.log(`Running on port: ${config.api.port}`);
});
