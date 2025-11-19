import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const now = new Date().toISOString();

    const command = new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: {
        pk: { S: "DEBUG#1" },
        sk: { S: now },
        gsi1pk: { S: "DEBUG" },
        gsi1sk: { S: now },
      },
    });

    await client.send(command);

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, at: now }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "write_failed" }),
    };
  }
};