export const BUILD_INFO = Object.freeze({
  appVersion: typeof __APP_VERSION__ === 'undefined' ? 'test' : __APP_VERSION__,
  commitSha: typeof __COMMIT_SHA__ === 'undefined' ? 'test' : __COMMIT_SHA__,
  deploymentEnvironment:
    typeof __DEPLOYMENT_ENV__ === 'undefined' ? 'test' : __DEPLOYMENT_ENV__,
})
