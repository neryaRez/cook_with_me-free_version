import {
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js'
import { userPool, isCognitoConfigured } from './cognitoClient.js'

function assertConfigured() {
  if (!isCognitoConfigured) {
    throw new Error(
      'Cognito is not configured. Set VITE_COGNITO_REGION, VITE_COGNITO_USER_POOL_ID, and VITE_COGNITO_APP_CLIENT_ID.'
    )
  }
}

function buildUser(email) {
  return new CognitoUser({ Username: email, Pool: userPool })
}

export function signUp({ email, password, name }) {
  assertConfigured()
  const attributes = [new CognitoUserAttribute({ Name: 'email', Value: email })]
  if (name) attributes.push(new CognitoUserAttribute({ Name: 'name', Value: name }))

  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, attributes, null, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

export function confirmSignUp(email, code) {
  assertConfigured()
  return new Promise((resolve, reject) => {
    buildUser(email).confirmRegistration(code, true, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

export function resendConfirmationCode(email) {
  assertConfigured()
  return new Promise((resolve, reject) => {
    buildUser(email).resendConfirmationCode((err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

export function signIn({ email, password }) {
  assertConfigured()
  const cognitoUser = buildUser(email)
  const authDetails = new AuthenticationDetails({ Username: email, Password: password })

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    })
  })
}

export function getCurrentSession() {
  assertConfigured()
  const cognitoUser = userPool.getCurrentUser()
  if (!cognitoUser) return Promise.resolve(null)

  return new Promise((resolve, reject) => {
    cognitoUser.getSession((err, session) => {
      if (err) return reject(err)
      resolve(session)
    })
  })
}

export function signOut() {
  assertConfigured()
  const cognitoUser = userPool.getCurrentUser()
  if (cognitoUser) cognitoUser.signOut()
}

export function forgotPassword(email) {
  assertConfigured()
  return new Promise((resolve, reject) => {
    buildUser(email).forgotPassword({
      onSuccess: (result) => resolve(result),
      onFailure: (err) => reject(err),
    })
  })
}

export function confirmForgotPassword({ email, code, password }) {
  assertConfigured()
  return new Promise((resolve, reject) => {
    buildUser(email).confirmPassword(code, password, {
      onSuccess: (result) => resolve(result),
      onFailure: (err) => reject(err),
    })
  })
}

export function claimsFromSession(session) {
  const idPayload = session.getIdToken().payload
  return {
    sub: idPayload.sub,
    email: idPayload.email,
    name: idPayload.name,
  }
}

export function tokensFromSession(session) {
  return {
    idToken: session.getIdToken().getJwtToken(),
    accessToken: session.getAccessToken().getJwtToken(),
  }
}
