/** @module routes/plugin/index
    @description routes for /:userid
*/
'use strict';

var router = require('express').Router();
var middleware = require('../middleware');
var handlers = require('./handlers');
var lib = require('../../lib');
var logger = lib.logger.appLogger;

logger.debug('Setting plugin routes');

router.post('/:pluginName/activate', middleware.isAuthenticated, 
  handlers.postActivate);

router.delete('/:pluginName/activate', middleware.isAuthenticated, 
  handlers.deleteActivate);

router.post('/:pluginName/install', middleware.isAuthenticated, 
  handlers.postInstall);

module.exports = router;