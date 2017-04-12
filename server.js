// init project
var compression = require('compression');
var express = require('express');

// setup a new database
var Datastore = require('nedb'),
    db = new Datastore({ filename: '.data/datafile', autoload: true });
var app = express();
var http = require('http');
var fs = require('fs');
var scrapeIt = require('scrape-it'); // https://github.com/IonicaBizau/scrape-it
var byLine = require('quickline').byLine;
var moment = require('moment-timezone');
var winnumsHostRemote = 'www.powerball.com';
var winnumsPathRemote = '/powerball/winnums-text.txt';
var winnumsPathLocal = 'winnums-text.txt';

/*-- DATABASE INITIALIZATION --*/
// Get the file from the Powerball site, parse it and add the drawings to the database.
// NOTE: this is only necessary when creating the database for the first time or if it needs to be recreated.
function dbInit () {
  var winnumsParsed = [];
  var processedLineNum = 0;

  function processWinnumsLine (x) {
    if (processedLineNum > 0 && processedLineNum < 49) {
      var line = x.split('  ');
      var dateArr = line[0].split('/');
      var dateSortable = dateArr[2] + dateArr[0] + dateArr[1];
      var draw = {
        date: line[0],
        dateSortable: dateSortable, // facilitate sorting in the database query
        dateLabel: moment(dateSortable).format('dddd M/D/YYYY'),
        white: [line[1], line[2], line[3], line[4], line[5]].sort(),
        red: line[6],
        multiplier: parseInt(line[7])
      };
      winnumsParsed.push(draw);
      db.insert(draw, function (err, drawAdded) {
        if(err) console.log("There's a problem with the database:", err);
        // else if(drawAdded) console.log('Drawing ' + draw.date + ' inserted in the database');
      });
    }
    processedLineNum++;
  }

  function parseWinnumsCB () {
    // Do not delete until the reference inside parseWinnums() is deleted.
  }

  function parseWinnums () {
    var options = {
      host: winnumsHostRemote,
      path: winnumsPathRemote
    };

    var callback = function (response) {
      var str = '';
      response.on('data', function (chunk) {
        str += chunk;
      });
      response.on('end', function () {
        // console.log(str);
        var wstream = fs.createWriteStream(winnumsPathLocal);
        wstream.on('finish', function () {
          var readStream = fs.createReadStream(winnumsPathLocal, {encoding: 'ascii'});
          byLine(readStream, processWinnumsLine, parseWinnumsCB);
        });
        wstream.write(str);
        wstream.end();
      });
    };
    http.request(options, callback).end();
  }
  parseWinnums();
  
  db.insert(winnumsParsed, function (err, drawingsAdded) {
    if (err) {
      console.log("There's a problem with the database: ", err);
    } else if (drawingsAdded) {
      // console.log("Drawings from winnums-text.txt inserted in the database");
      db.count({}, function (err, count) {
        // console.log("There are " + count + " drawings in the database");
        if (err) console.log("There's a problem with the database: ", err);
      });
    }
  });
}
/*-- END DATABASE INITIALIZATION --*/


/*-- APP STARTUP DATABASE CHECK --*/
// This runs when the server is started:
db.count({}, function (err, count) {
  // console.log("There are " + count + " drawings in the database");
  if (err) console.log("There's a problem with the database: ", err);
  else if (count <= 0) dbInit(); // database is empty so let's populate it
});
/*-- END APP STARTUP DATABASE CHECK --*/


/*-- EXPRESS ROUTING --*/
// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));
app.use(compression());
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/drawings", function (request, response) {
  var dateNow = moment().tz('America/New_York');
  var dateStr = dateNow.format('MM/DD/YYYY');
  var hourNow = dateNow._d.getHours();
  var minuteNow = dateNow._d.getMinutes();
  var dayOfWeek = dateNow._d.getDay();
  var isDrawDay = dayOfWeek === 3 || dayOfWeek === 6;
  // The "Magic Hour" occurs after 2304 on draw day when we can expect that day's
  // results to be posted to the Powerball.com homepage:
  var isMagicHour = isDrawDay && hourNow === 23 && minuteNow > 4;
  // Calculate the last drawing date. If we're not in the Magic Hour, use the most recent Wednesday or Saturday:
  var lastDrawDateStr = isMagicHour ? dateStr : dateNow.day(dayOfWeek > 3 ? 3 : -1).format('MM/DD/YYYY');
  // console.log('isDrawDay: ' + isDrawDay);
  // console.log('isMagicHour: ' + isMagicHour);
  // console.log('lastDrawDateStr: ' + lastDrawDateStr);
  // console.log('dateStr: ' + dateStr);
  
  function sendDrawings () {
    var responseData = [];
    db.find({}).sort({ dateSortable: -1 }).limit(48).exec(function (err, drawings) {
      drawings.forEach(function(drawing) {
        responseData.push({"date": drawing.date, "white": drawing.white, "red": drawing.red.toString(), "multiplier": drawing.multiplier});
      });
      response.json(responseData);
    });
  }
  
  function getLatestResults (drawingDate) {
    var scrapedData;
    var website = 'http://www.powerball.com';
    scrapeIt(website, {
      date: {
        selector: '#winnums h5',
        convert: t => t.replace('Winning Numbers ', '')
      },
      white: {
        listItem: '#winnums .white.ball'
      },
      red: {
        selector: '#winnums .red.ball',
        convert: r => r < 10 ? '0' + r : r
      },
      multiplier: {
        selector: '#powerplay .powerplay_value',
        convert: m => parseInt(m)
      }
    }, (err, page) => {
      if (!err && page) {
        scrapedData = page;
        
        for (var i = 0; i < 5; i++) {
          var ball = scrapedData.white[i];
          if (ball < 10) {
            scrapedData.white[i] = '0' + ball;
          }
        }
        var dateArr = scrapedData.date.split('/');
        if (dateArr[0] < 10) {
          dateArr[0] = '0' + dateArr[0];
        }
        if (dateArr[1] < 10) {
          dateArr[1] = '0' + dateArr[1];
        }
        scrapedData.date = dateArr.join('/');
        var dateSortable = dateArr[2] + dateArr[0] + dateArr[1];
        scrapedData.dateSortable = dateSortable;
        scrapedData.dateLabel = moment(dateSortable).format('dddd M/D/YYYY');
        // console.log('dateSortable', dateSortable);
        // console.log('drawingDate', drawingDate);
        // console.log('moment(dateSortable).format(\'MM/DD/YYYY\')', moment(dateSortable).format('MM/DD/YYYY'));
        if (drawingDate !== moment(dateSortable).format('MM/DD/YYYY')) {
          db.insert(scrapedData, function (err, resultsAdded) {
            if (err) {
              console.log("There's a problem adding scraped results to the database: ", err);
            } else if (resultsAdded) {
              console.log("Results inserted in the database for " + scrapedData.date + " drawing");
              sendDrawings();
            } else {
              console.log("No error, but the latest results may not have been added.");
            }
          });
        } else {
          sendDrawings();
        }
      } else {
        console.log('Error scraping Powerball homepage:', err);
      }
    });
  }
  
  // Check if the database has the results from the last draw date
  var dbHasLatestResults = false;
  db.find({}).sort({ dateSortable: -1 }).limit(1).exec(function (err, drawings) {
    drawings.forEach(function(drawing) {
      dbHasLatestResults = drawing.date == lastDrawDateStr;
      // console.log('drawing.date: ' + drawing.date);
      // console.log('lastDrawDateStr: ' + lastDrawDateStr);
      // console.log('dbHasLatestResults (getLatestResults if false): ' + dbHasLatestResults);
    });
  
    // If we have the latest results, send them. If not, scrape them (and then send them):
    if (dbHasLatestResults) {
      sendDrawings();
    } else {
      // console.log('Else: getLatestResults');
      getLatestResults();
    }
  });
});

// Un-comment if necessary to recreate the database with results scraped from the historical file on the Powerball site:
// removes entries from db and populates it with default drawings

app.get("/reset", function (request, response) {
  // removes all entries from the collection
  db.remove({}, {multi: true}, function (err) {
    if (err) {
      console.log("There's a problem with the database: ", err);
    } else {
      console.log("Database cleared");
      dbInit();
      response.redirect("/");
    }
  });
});

// listen for requests
var listener = app.listen(process.env.PORT, function () {
  // console.log('Your app is listening on port ' + listener.address().port);
});