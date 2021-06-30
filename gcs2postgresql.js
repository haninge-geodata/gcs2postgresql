// Based on code examples from https://cloud.google.com/storage/docs/downloading-objects

// Imports the Google Cloud client library
const { Storage } = require('@google-cloud/storage');
// Imports bluebird Promises
const Promise = require('bluebird');
// Imports a simple Node scheduler
const cron = require('node-cron');
// Imports the PostgreSQL library and creates a db connection with new default schema
const pgp = require('pg-promise');
// Imports the config file
const config = require('./config.json');
// The ID of your GCS bucket
const bucketName = config.gcBucketName;

// Set log level constants
const LOG_LEVELS = {
  errors: 3,
  warnings: 2,
  info: 1,
  debug: 0
};

// Create a connection using pg-promise
const pgconnection = pgp({
  schema: config.dbConfig.schema
});
// Create a new database instance using the connection
const db = pgconnection(config.dbConfig);

// Creates a client from a Google service account key
const storage = new Storage({ keyFilename: config.gcKeyFile });

// Function for downloading a JSON asynchronously from a readable stream
function downloadJSON(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

// Schedule downloads every 5 minutes with a two minute offset (to hopefully get the updates file asap)
config.gcFiles.forEach((gcFile) => {
  cron.schedule(gcFile.downloadCronSchedule, () => {
    try {
      // Re-read the config file to allow changing some parameters in flight (such as log level)
      config = require('./config.json');
      if (LOG_LEVELS[config.logLevel] <= LOG_LEVELS.info) {
        console.log(`${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}: Fetching ${gcFile.name}`);
      }
      // Get a readable stream for the GC Storage file to download
      const stream = storage.bucket(bucketName).file(gcFile.name).createReadStream();
      // Download from the stream and then insert data into PostgreSQL
      downloadJSON(stream)
        .then(JSON.parse)
        .then((jsonData) => {
          // Performant multi-row insert from https://stackoverflow.com/a/37302557/1461981

          // our set of columns, to be created only once (statically), and then reused,
          // to let it cache up its formatting templates for high performance:
          const cs = new pgconnection.helpers.ColumnSet(gcFile.columnSet, { table: gcFile.name.split('.')[0] });
          // generating a multi-row insert query:
          let query = pgconnection.helpers.insert(jsonData, cs);

          // If the 'appendData' config flag is false, all table rows are deleted before inserting new data.
          if (jsonData.length > 0 && !gcFile.appendData) {
            if (LOG_LEVELS[config.logLevel] <= LOG_LEVELS.debug) {
              console.log(`${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}: ${jsonData.length} JSON objects found. Clearing table before inserting.`);
            }
            query = `begin;\ndelete from ${gcFile.name.split('.')[0]};\n${query};\ncommit;`;
          } else if (LOG_LEVELS[config.logLevel] <= LOG_LEVELS.warnings) {
            console.warn(`${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}: No JSON objects found.`);
          }
          if (LOG_LEVELS[config.logLevel] <= LOG_LEVELS.debug) {
            console.log(`${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}:\n${query}`);
          }
          // executing the query:
          return db.none(query)
            .catch(LOG_LEVELS[config.logLevel] <= LOG_LEVELS.errors ? (e) => console.error(e) : e => e);
        })
        .catch(LOG_LEVELS[config.logLevel] <= LOG_LEVELS.errors ? (e) => console.error(e) : e => e)
        .finally(LOG_LEVELS[config.logLevel] <= LOG_LEVELS.info ? (e) => {
          if (e === undefined) {
            console.log(`${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}: Transaction completed.`);
          }
          return e;
        } : e => e);
    } catch (error) {
      if (LOG_LEVELS[config.logLevel] <= LOG_LEVELS.errors) {
      console.error(error);
    }
    }
  });
});
