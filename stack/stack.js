const apigateway = require('@aws-cdk/aws-apigatewayv2')
const dynamodb = require('@aws-cdk/aws-dynamodb')
const lambda = require('@aws-cdk/aws-lambda')
const cdk = require('@aws-cdk/core')

class YJSWebsocketDynamoDBStack extends cdk.Stack {
  constructor(app, id) {
    super(app, id)

    const dynamoTable = new dynamodb.Table(this, id+'-docs', {
      partitionKey: {
        name: 'PartitionKey',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SortKey',
        type: dynamodb.AttributeType.STRING,
      },
      tableName: 'docs',
      // TODO retain
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Lambda for Websocket API

    const websocketLambda = new lambda.Function(this, id+'-websocket-lambda', {
      code: new lambda.AssetCode('../server/handler'),
      handler: 'aws.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
      },
      currentVersionOptions: {
        // CloudFormation tries to delete lambda before moving alias, this fixes the error:
        removalPolicy: cdk.RemovalPolicy.RETAIN
      }
    })

    // Lambda autoscaling (negate cold starts)

    websocketLambda.currentVersion.addAlias(id+'-websocket-lambda-alias')
    
    // const autoScale = alias.addAutoScaling({
    //   maxCapacity: 10,
    //   minCapacity: 2,
    // })
    
    // autoScale.scaleOnUtilization({
    //   utilizationTarget: 0.5,
    //   policyName: id+'-lambda-scaler',
    // })
    
    dynamoTable.grantReadWriteData(websocketLambda)
    
    // TODO verify below
    const api = new apigateway.CfnApi(this, id+'-websocket-api', {
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$requests.body.action',
    })

    // TODO this instead? new apigateway.LambdaIntegration(websocketLambda)
    const connectIntegration = new apigateway.CfnIntegration(this, id+'-websocket-integration', {
      apiId: api.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: 'arn:aws:apigateway:' + config['region'] + ':lambda:path/2015-03-31/functions/' + connectFunc.functionArn + '/invocations',
      credentialsArn: role.roleArn,
    })

    const connectRoute = new apigateway.CfnRoute(this, id+'-websocket-route', {
      apiId: api.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      target: 'integrations/' + connectIntegration.ref,
    })

    const deployment = new apigateway.CfnDeployment(this, id+`-deployment`, {
      apiId: api.ref,
    })

    new apigateway.CfnStage(this, id+`-stage`, {
      apiId: api.ref,
      autoDeploy: true,
      deploymentId: deployment.ref,
      stageName: 'dev',
    })

    const dependencies = new ConcreteDependable()
    dependencies.add(connectRoute)
  }
}

const app = new cdk.App()
new YJSWebsocketDynamoDBStack(app, 'yjs', {
  env: { region: 'us-east-1' },
})