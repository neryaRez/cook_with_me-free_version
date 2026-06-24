// Module-level singleton so plain modules (api.js) can read the current
// token without importing React context. Only AuthContext writes to it.
let idToken = null

export function setIdToken(token) {
  idToken = token
}

export function getIdToken() {
  return idToken
}

export function clearIdToken() {
  idToken = null
}
