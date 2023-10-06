import { Logger } from './logger';

global.log = Logger.log;
global.debug = Logger.debug;
global.error = Logger.error;
