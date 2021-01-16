const {AssetCode, Function, Runtime} = require('@aws-cdk/aws-lambda')
const {CfnApi, CfnDeployment, CfnIntegration, CfnRoute, CfnStage} = require('@aws-cdk/aws-apigatewayv2')
const {App, ConcreteDependable, Duration, RemovalPolicy, Stack} = require('@aws-cdk/core')
const {Effect, PolicyStatement, Role, ServicePrincipal} = require('@aws-cdk/aws-iam')
const {AttributeType, Table, BillingMode} = require('@aws-cdk/aws-dynamodb')
const config = require('./config.json')

class WebsocketDynamoDBStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    // Initialize API
  
    const name = id + '-api'
    const api = new CfnApi(this, name, {
      name: 'WebsocketApi',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    })

    // Create tables

    const docsTable = new Table(this, `${name}-docs-table`, {
      partitionKey: {
        name: 'PartitionKey',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'SortKey',
        type: AttributeType.STRING,
      },
      tableName: 'docs',
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // TODO for prod use RETAIN
    })

    const connectionsTable = new Table(this, `${name}-connections-table`, {
      partitionKey: {
        name: 'PartitionKey',
        type: AttributeType.STRING,
      },
      tableName: 'connections',
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // TODO for prod use RETAIN
    })

    // Initialize lambda

    const messageFunc = new Function(this, `${name}-message-lambda`, {
      code: new AssetCode('../server/build'),
      handler: 'index.handler', // TODO use rollup
      runtime: Runtime.NODEJS_12_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      currentVersionOptions: {
        // CloudFormation tries to delete lambda before moving alias, this fixes the error:
        removalPolicy: RemovalPolicy.RETAIN
      },
      initialPolicy: [
        new PolicyStatement({
          actions: [
            'execute-api:ManageConnections'
          ],
          resources: [
            'arn:aws:execute-api:' + config['region'] + ':' + config['account_id'] + ':' + api.ref + '/*'
          ],
          effect: Effect.ALLOW,
        })
      ],
      environment: {
        DOCS_TABLE_NAME: docsTable.tableName,
        CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
        REGION: config['region'],
      }
    })

    // Add lambda permissions

    docsTable.grantReadWriteData(messageFunc)
    connectionsTable.grantReadWriteData(messageFunc)

    // Lambda autoscaling (destroy cold starts)

    messageFunc.currentVersion.addAlias(id+'-message-lambda-alias')

    // const autoScale = alias.addAutoScaling({
    //   maxCapacity: 10,
    //   minCapacity: 2,
    // })
    
    // autoScale.scaleOnUtilization({
    //   utilizationTarget: 0.5,
    //   policyName: id+'-lambda-scaler',
    // })

    // Access role for the socket api to access the socket lambda
  
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [
        messageFunc.functionArn,
      ],
      actions: ['lambda:InvokeFunction'],
    })

    const role = new Role(this, `${name}-iam-role`, {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com')
    })
    role.addToPolicy(policy)

    // Integrate lambda with Websocket API
  
    const messageIntegration = new CfnIntegration(this, `${name}-message-route-lambda-integration`, {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: 'arn:aws:apigateway:' + config['region'] + ':lambda:path/2015-03-31/functions/' + messageFunc.functionArn + '/invocations',
      credentialsArn: role.roleArn,
    })

    const messageRoute = new CfnRoute(this, `${name}-message-route`, {
      apiId: api.ref,
      routeKey: '$default',
      authorizationType: 'NONE',
      target: 'integrations/' + messageIntegration.ref,
    })

    const deployment = new CfnDeployment(this, `${name}-deployment`, {
      apiId: api.ref,
    })

    new CfnStage(this, `${name}-stage`, {
      apiId: api.ref,
      autoDeploy: true,
      deploymentId: deployment.ref,
      stageName: config['stage'],
    })

    const dependencies = new ConcreteDependable()
    dependencies.add(messageRoute)
    deployment.node.addDependency(dependencies)
  }
}

const app = new App()

new WebsocketDynamoDBStack(app, 'yjs')
