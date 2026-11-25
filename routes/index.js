const registerUploadsAndMusic = require('./uploadsMusic');
const registerRtsRoutes = require('./rts');
const registerHolidayRoutes = require('./holidays');
const registerUserRoutes = require('./users');
const registerFileRoutes = require('./files');
const registerForumRoutes = require('./forum');
const registerSiteDeployRoute = require('./siteDeploy');

function registerRoutes(app, dependencies) {
  app.use(registerUploadsAndMusic(dependencies));
  app.use(registerRtsRoutes(dependencies));
  app.use(registerHolidayRoutes(dependencies));
  app.use(registerUserRoutes(dependencies));
  app.use(registerFileRoutes(dependencies));
  app.use(registerForumRoutes(dependencies));
  app.use(registerSiteDeployRoute(dependencies));
}

module.exports = registerRoutes;
