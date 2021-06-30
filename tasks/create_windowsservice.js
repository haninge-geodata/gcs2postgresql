import { Service } from 'node-windows';

// Create a new service object
const svc = new Service({
  name: 'gcs2postgresql',
  description: 'NodeJS server app for fetching JSON from a Google Cloud Storage API and inserting it into PostgreSQL with repeated intervals.',
  script: '..\\gcs2postgresql.js'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', () => {
  svc.start();
});

svc.install();
