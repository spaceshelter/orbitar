require('dotenv-flow').config();
const mysql = require('mysql2');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const sizeOf = require('image-size');

const MEDIA_TYPE_IMG = 'img';
const MEDIA_TYPE_VIDEO = 'video';

const config = {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: "root",
    password: process.env.MYSQL_ROOT_PASSWORD || "orbitar",
    database: process.env.MYSQL_DATABASE || "orbitar_db",
    dir: './media-backup',
    dbFile: './media-backup/index.csv'
};

const sleep = function(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

const download = function(url, dest, cb) {
  if (url.match(/^\/\//)) {
    url = 'https:' + url;
  }
  try {
    const file = fs.createWriteStream(dest);
    let loader = http;
    if (url.includes('https://')) {
      loader = https;
    }
    loader.get(url, function(response) {
      response.pipe(file);
      file.on('finish', function() {
        file.close(cb);
      });
    }).on('error', function(err) {
      console.trace(err);
      fs.unlinkSync(dest);
      if (cb) cb(err.message);
    });
  } catch (e) {
    console.trace(e);
  }
};

try { fs.mkdirSync(config.dir); } catch (e) {}
if (!fs.existsSync(config.dbFile)) {
  fs.openSync(config.dbFile, 'w+');
  fs.appendFileSync(config.dbFile, 'item_type,item_id,media_type,media_src,media_id,img_width,img_height  ' + "\n");
} else {
  fs.openSync(config.dbFile, 'w+');
}

const connection = mysql.createConnection({
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database
});

const entries = [];

connection.query(
  'SELECT html, "comment" as type, comment_id as "item_id" FROM `comments` WHERE `html` like "%<img%" UNION ' +
  'SELECT html, "comment" as type, comment_id as "item_id" FROM `comments` WHERE `html` like "%<video%" UNION ' +
  'SELECT html, "post" as type, post_id as "item_id" FROM `posts` WHERE `html` like "%<img%" UNION ' +
  'SELECT html, "post" as type, post_id as "item_id" FROM `posts` WHERE `html` like "%<source%"',
  async function (err, results, fields) {
    if (err) {
      console.trace(err);
      process.exit(1);
    }
    console.log('Total items with media content: ', results.length);
    for (let i = 0; i < results.length; i++) {
      entries.push(results[i]);
      if (i % 1000 === 0) {
        console.log(`Fetched ${entries.length} entries`);
      }
    }
    await startDownload();
    process.exit(0);
});

const startDownload = async function() {
  console.log('Starting processing');
  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i];
    let itemType = entry.type;
    let itemId = entry.item_id;
    let entryHtml = entry.html;

    const mediaItems = entryHtml.match(/<(img|source).+src=['"]([^'"]+)['"]/g);
    for (let ii = 0; ii < mediaItems.length; ii++) {
      const check = mediaItems[ii].match(/<(img|source).+src=['"]([^'"]+)['"]/);
      let mediaType = check[1] === MEDIA_TYPE_IMG ? MEDIA_TYPE_IMG : MEDIA_TYPE_VIDEO;
      let mediaSrc = check[2];
      let mediaExtensionMatch = mediaSrc.match(/\.[a-z]{2,}(?:\?.+)?$/);
      let mediaExtension;
      if (!mediaExtensionMatch) {
        if (mediaType === MEDIA_TYPE_IMG) {
          mediaExtension = '.jpg';
        } else {
          mediaExtension = '.mp4';
        }
      } else {
        mediaExtension = mediaExtensionMatch[0].replace(/\?.+?$/, '');
      }

      let outputFilename = crypto.createHash('sha256').update(mediaSrc).digest('hex') + mediaExtension;
      let outputPath = config.dir + '/' + outputFilename;
      let dimensions = {width: 0, height: 0};

      const saveEntry = function() {
        if (mediaType === MEDIA_TYPE_IMG) {
          try {
            dimensions = sizeOf(outputPath);
          } catch (e) {
            dimensions = {width: 0, height: 0};
          }
        }
        let line = [
          itemType, itemId, mediaType, mediaSrc, outputFilename, dimensions.width, dimensions.height
        ];
        fs.appendFileSync(config.dbFile, line.join(',') + "\n");
      }

      if (fs.existsSync(outputPath)) {
        console.log(outputPath, 'is already there');
        saveEntry();
        continue;
      }
      download(mediaSrc, outputPath, async function() {
        saveEntry();
        console.log('Downloaded:', itemType, itemId, mediaType, mediaSrc, config.dir + '/' + outputFilename, dimensions.width, 'x', dimensions.height);
      });
      await sleep(500);
      if (i % 1000 === 0) {
        console.log(`Processed ${i} entries`);
      }
    }
  }
};


