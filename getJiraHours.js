// # http get all issues in the project with their epics and all epics
// # store in hashmap
// # for each issue get the worklog

const fetch = require('node-fetch');

const username="jno"
const password=process.env["PW"]

let headers = new fetch.Headers();
headers.set('Authorization', 'Basic ' + Buffer.from(username + ":" + password).toString('base64'));

function callApi(path, args) {
  if (path[0] === '/') {
    path = "https://jira.huygens.knaw.nl/rest/api/2" + path;
  }
  const qry = args ?
    "?" + Object.keys(args).map(key => key + "=" + encodeURIComponent(args[key])).join("&") :
    "";
  return fetch(path + qry, {method:'GET', headers: headers})
    .then(result => result.json());
}

function getTimeTracked(project, fromDate) {
  const url=`https://jira.huygens.knaw.nl/rest/api/2/search?`+[].map(([k,v]) => k + "=" + encodeURIComponent(v)).join("&")
  return callApi("/search", {
      "startIndex": 0,
      "jql": `project = "${project}" and updated > ${fromDate} and timespent > 0`,
      "fields": "key,customfield_10100",
      "maxResults": 1000
    })
    .then(result => result.issues.map(i => ({url: i.self, epic: i.fields.customfield_10100})))
    .then(issues => 
      Promise.all(
        issues.map(i => 
          callApi(i.url + "/worklog")
            .then(worklog => worklog.worklogs.map(w => ({id: w.id, date: w.started, user: w.author.key, feature: i.epic, time: w.timeSpentSeconds / 3600})))
        )
      )
    )
    .then(x => x.reduce((a, x)=>a.concat(x), []))
}

function getFeatures() {
  return callApi("/search", {
      "startIndex": 0,
      "jql": `project = "Team Red" AND type = Epic`,
      "fields": "key,summary,customfield_10800,assignee,customfield_10101",
      "maxResults": 1000
    })
    .then(x => x.issues.map(i => ({
      featureCode: i.key, 
      summary: i.fields.summary, 
      product: i.fields.customfield_10800 && i.fields.customfield_10800.value, 
      productOwner: i.fields.assignee && i.fields.assignee.key, 
      status: i.fields.customfield_10101 && i.fields.customfield_10101.value
    })))
}

const fs = require("fs");
getFeatures()
  .then(y => y.map(x => x.featureCode + ";" + x.summary + ";" + x.product + ";" + x.productOwner + ";" + x.status).join("\n"))
  .then(x => fs.writeFileSync("./features.csv", "featureCode;summary;product;productOwner;status\n" + x))
  .catch(e => console.log(e));


getTimeTracked("Team Red", "2018-11-01")
  .then(y => y.map(x => x.id + ";" + x.date + ";" + x.user + ";" + x.feature + ";" + x.time).join("\n"))
  .then(x => fs.writeFileSync("./timetracked.csv", "id;date;user;feature;time\n" + x))
  .catch(e => console.log(e));

