## YJS for AWS Websocket API
This is a demo of YJS working with AWS Websocket API and DynamoDB. The intent is for this to become a library where you can run a few CLI commands and launch a fully scalable YJS infrastructure on AWS.

## Getting Started
The `client` folder is a frontend demo of YJS with SlateJS. You can initialize `client` with `npm i && npm start`. It depends on the `server` folder which has a local version of the YJS for AWS backend, based off y-websocket. You can initialize `server` with `npm i && npm start`. The `stack` folder is the full CDK stack for the `server`. Run `npm i` and `npm i -g aws-cdk` then use the CDK CLI to deploy the infrastructure.

## Docker

with WSL2 see fix here https://github.com/docker/compose/issues/7495#issuecomment-649035078

```sh
cd local-db
docker-compose up # run local dynamodb server
npm run setup # create tables
```

Debug
```sh
aws dynamodb list-tables --endpoint-url http://localhost:8000
aws dynamodb scan --table-name docs --endpoint-url http://localhost:8000
```

## Deploy
TBD

## TODO
- create the CDK infrastructure
- create the Websocket API handlers
- compile the node.js 14 code to node.js 12 (make sure node modules is prod only)
- deploy on AWS
