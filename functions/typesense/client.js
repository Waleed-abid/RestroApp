const Typesense = require("typesense");
const functions = require("firebase-functions");

const client = new Typesense.Client({
  nodes: [
    {
      host: functions.config().secret.typesense_host,
      port: functions.config().secret.typesense_port,
      protocol: functions.config().secret.typesense_protocol,
    },
  ],
  apiKey: functions.config().secret.typesense_api_key,
  connectionTimeoutSeconds: 5,
});

module.exports = client;
