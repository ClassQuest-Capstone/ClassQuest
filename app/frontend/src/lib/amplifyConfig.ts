/**
 * Amplify initialization — must be evaluated before any generateClient() call.
 *
 * Imported as a side-effect in graphqlClient.ts so that Amplify.configure()
 * always runs before the singleton GraphQL client is created, regardless of
 * how the ES module graph is traversed at startup.
 *
 * index.tsx also calls Amplify.configure(awsExports) for auth; that second
 * call with the same config object is harmless.
 */
import { Amplify } from "aws-amplify";
import awsExports from "../aws-exports.ts";

Amplify.configure(awsExports);

export {};
