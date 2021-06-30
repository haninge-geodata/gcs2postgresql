# gcs2postgresql
NodeJS server app for fetching JSON files from a Google Cloud Storage API and inserting it into PostgreSQL with repeated intervals.

The app assumes that there are existing tables in PostgreSQL with the same names as the files being downloaded, and whose table schemas map perfectly to the data structures in the JSON files.

### Install gcs2postgresql
The minimum requirements are:

- Git
- Node.js (version 4 or higher is recommended)

1. To get your own local copy of gcs2postgresql use git to clone the repository with the command below:
```
git clone https://github.com/haninge-geodata/gcs2postgresql.git
```
2. To install the required node dependencies run the following command from the root directory of origo-server:
```
npm install
```
3. Acquire a JSON key file.
   1. Generate a service account: The [Google Cloud Storage Console](https://console.cloud.google.com/) can be used to create a service account in "APIs & Services --> Credentials". This can be created on the account of the API owner and provided to you, or you can create it on your own account.
   2. Find the Service account details (e g by clicking on the service account in Credentials), go to the KEYS tab and choose ADD KEY --> Create new key.
   3. Store the key file somewhere safe and put a copy somewhere accessible to gcs2postgresql.
4. Update the config.json file with your specific details
   1. The name of the Google Cloud Storage Bucket
   2. The list of JSON files to download
      1. Filename
      2. An array of columns/attributes on each JSON object in the file
      3. What scheduling interval to use, see the [`node-cron`](https://www.npmjs.com/package/cron) docs for syntax tips.
      4. Whether to append data to the target tables (true) or clear the tables before each download.
   3. The path to the key file from step 3 above.
   4. The connection details for your target PostgreSQL server. 
5. To start gcs2postgresql, run:
```
node gcs2postgresql.js
```
### Install gcs2postgresql as a Windows service
gcs2postgresql can be installed as a Windows service. Complete steps 1-5 above, then run the following command from tasks:
```
node create_windowsservice.js
```
To uninstall run the following command from tasks:
```
node uninstall_windowsservice.js
```
