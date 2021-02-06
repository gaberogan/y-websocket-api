## Working Demo
https://gaberogan.github.io/y-websocket-api/

## YJS for AWS Websocket API
This is a demo of YJS working with AWS Websocket API and DynamoDB. The intent is for this to become a library where you can run a few CLI commands and launch a fully scalable YJS infrastructure on AWS.

## Getting Started
The `client` folder is a frontend demo of YJS with SlateJS. You can initialize `client` with `npm i && npm start`. It depends on the `server` folder which has a local version of the YJS for AWS backend, based off y-websocket. You can initialize `server` with `npm i && npm start`. The `server` folder in turn depends on the `local-db` folder, which you can find setup instructions for below. The `stack` folder is the full CDK stack for the `server`. Run `npm i` and `npm i -g aws-cdk` then use the `npm run deploy` to deploy the infrastructure.

## Docker

with WSL2 see fix here https://github.com/docker/compose/issues/7495#issuecomment-649035078

```sh
cd local-db
npm start # run dynamodb local
npm run setup # create tables on server start
```

Debug
```sh
aws dynamodb list-tables --endpoint-url http://localhost:8000
aws dynamodb scan --table-name docs --endpoint-url http://localhost:8000
```

## Troubleshooting

- use node >= v 14.15.4
- make sure aws cli is correct region in stack/config.json and local-env.cjs
- replace account id with yours in stack/config.json
- make sure client/services/state.js has the endpoint you want
- make sure you've configured your aws cli. if you have multiple accounts, add --profile MYPROFILE to deploy command in stack
- in client/services/state.js change the endpoint to ws://localhost:9000

## Known Issues

- can't handle json error from websocket
- new connections keep getting created for some reason
- max document size 400KB (planning to fix)
- doesn't flush document history at the moment
