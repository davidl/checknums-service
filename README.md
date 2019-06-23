# checknums-service

This service provides Powerball drawing results and upcoming jackpot information (as JSON) using data from [Powerball.com](http://powerball.com). The output of this service is consumed by [checknums.com](https://checknums.com) where you can check multiple Powerball tickets quickly and easily.

Additionally, this site is not intended to be visited directly, except by automated visits by [cron-job](https://cron-job.org/en/) to trigger checking for updates (drawing results and jackpot information). Instead, [GitHub Pages](https://pages.github.com/) hosts the [CheckNums source code](https://github.com/davidl/checknums/) and [Cloudflare](https://www.cloudflare.com/) provides [SSL and caching](https://blog.cloudflare.com/secure-and-fast-github-pages-with-cloudflare/). When new information is obtained, it's stored in a database (using [NeDB](https://github.com/louischatriot/nedb)), updated JSON files are written then pushed to GitHub Pages, the CloudFlare cache of the GitHub Pages is cleared and drawing results are announced via [Twitter](http://www.twitter.com/CheckNums). To fulfill these actions, you need to ensure you have access to the Twitter, GitHub, and CloudFlare APIs.

Pushing the code to GitHub/Cloudflare avoids the need to wake-up this Glitch site except to check for updated information. 

## Keys stored in `.env` include:
### Twitter
* `CONSUMER_KEY`
* `CONSUMER_SECRET`
* `ACCESS_TOKEN`
* `ACCESS_TOKEN_SECRET`

### Github
* `GH_TOKEN`
* `GH_USER_NAME`
* `GH_USER_EMAIL`
* `GH_USER`
* `GH_REPO`

### CloudFlare
* `CF_USER_EMAIL`
* `CF_KEY`
* `CF_ZONE_ID`
* `PROD_URL` (_e.g._, `'https://checknums.com/'`)