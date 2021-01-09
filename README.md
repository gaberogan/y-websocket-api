## YJS for AWS Websocket API
This is a demo of YJS working with AWS Websocket API and DynamoDB. The intent is for this to become a library where you can run a few CLI commands and launch a fully scalable YJS infrastructure on AWS.

## Getting Started
The `client` folder is a frontend demo of YJS with SlateJS. You can initialize `client` with `npm i && npm start`. It depends on the `server` folder which has a local version of the YJS for AWS backend, based off y-websocket. You can initialize `server` with `npm i && npm start`. The `stack` folder is the full CDK stack for the `server`. Run `npm i` and `npm i -g aws-cdk` then use the CDK CLI to deploy the infrastructure.

## Deploy
TBD

## TODO
- create the CDK infrastructure
- create the Websocket API handlers
- compile the node.js 14 code to node.js 12 (make sure node modules is prod only)
- deploy on AWS