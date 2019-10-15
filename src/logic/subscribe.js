const get = require('lodash.get');
const { logger } = require('lambda-monitor-logger');
const lambda = require('./util/lambda')({
  region: process.env.AWS_REGION
});

module.exports = () => lambda
  .getAllFunctions({
    TagFilters: [{
      Key: 'STAGE',
      Values: [process.env.ENVIRONMENT]
    }]
  })
  .then(lambda.appendLogSubscriptionInfo)
  .then((functions) => {
    const monitor = functions.find((f) => get(f, 'Tags.MONITOR', null) === '1');
    const monitored = functions
      .filter((f) => get(f, 'Tags.MONITORED', null) !== '0')
      .filter((f) => f.subscriptionFilters.every((e) => e.destinationArn !== monitor.FunctionARN));
    return Promise.all(monitored.map((producer) => lambda.subscribeCloudWatchLogGroup(monitor, producer)));
  }).catch((e) => {
    if (e.name === 'ThrottlingException') {
      logger.error('CloudWatch subscription logic temporarily throttled by AWS.');
    } else {
      throw e;
    }
  });
