import { CognitoUserPool } from 'amazon-cognito-identity-js'

const REGION = import.meta.env.VITE_COGNITO_REGION
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID
const APP_CLIENT_ID = import.meta.env.VITE_COGNITO_APP_CLIENT_ID

export const isCognitoConfigured = Boolean(REGION && USER_POOL_ID && APP_CLIENT_ID)

export const userPool = isCognitoConfigured
  ? new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: APP_CLIENT_ID })
  : null
