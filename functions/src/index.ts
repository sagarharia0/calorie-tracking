// Cloud Functions entry. Each callable is exported by name; Firebase routes
// callable invocations to `httpsCallable(functions, '<name>')` on the client.
//
// Deploy:  firebase deploy --only functions
// Logs:    firebase functions:log

export { requestSwaps } from './swap'
export { suggestFoods } from './suggestFoods'
export { insightSummary } from './insightSummary'
