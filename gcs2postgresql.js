// Based on code examples from https://cloud.google.com/storage/docs/downloading-objects

const config = require('./config.json');

// The ID of your GCS bucket
const bucketName = config.gcBucketName;
// The file names and columns of your GCS files to download
const files = config.gcFiles;
// Imports bluebird Promises
var Promise = require('bluebird');
// Imports a simple Node scheduler
const cron = require('node-cron');
// Imports the PostgreSQL library and creates a db connection with new default schema
const pgp = require('pg-promise')({
  schema: config.dbConfig.schema
});
// Creating a new database instance with connection details
const db = pgp(config.dbConfig);

// Imports the Google Cloud client library
const {Storage} = require('@google-cloud/storage');
// Creates a client from a Google service account key
const storage = new Storage({keyFilename: config.gcKeyFile});


// Function for downloading a JSON asynchronously from a readable stream
function downloadJSON (stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

// Schedule downloads every 5 minutes with a two minute offset (to hopefully get the updates file asap)
config.gcFiles.forEach(gcFile => {
  cron.schedule(gcFile.downloadCronSchedule, () => {
    // Get a readable stream for the GC Storage file to download
    const stream = storage.bucket(bucketName).file(gcFile.name).createReadStream();
    // Download from the stream and then insert data into PostgreSQL
    downloadJSON(stream)
      .then(JSON.parse)
      // If the 'appendData' config flag is true, all table rows are deleted before inserting new data.
      .then(gcFile.appendData ? function(jsonData) { return jsonData; }() : function() {
        return db.none(`DELETE FROM ${gcFile.name.split(".")[0]}`)
          .catch(console.error);
      }())
      .then(async function(jsonData) {
        //Performant multi-row insert from https://stackoverflow.com/a/37302557/1461981

        // our set of columns, to be created only once (statically), and then reused,
        // to let it cache up its formatting templates for high performance:
        const cs = new pgp.helpers.ColumnSet(gcFile.columnSet, { table: gcFile.name.split(".")[0] });
        // generating a multi-row insert query:
        const query = pgp.helpers.insert(jsonData, cs);
        // executing the query:
        return await db.none(query)
          .catch(console.error);
      })
      .catch(console.error);
  });
});