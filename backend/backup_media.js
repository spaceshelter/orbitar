require('dotenv-flow').config();
const mysql = require('mysql2');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const sizeOf = require('image-size');

const MEDIA_TYPE_IMG = 'img';
const MEDIA_TYPE_VIDEO = 'video';
const SLEEP_BETWEEN_BATCHES_MS = 1000;
const BATCH_SIZE = 1000;

const config = {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: "root",
    password: process.env.MYSQL_ROOT_PASSWORD || "orbitar",
    database: process.env.MYSQL_DATABASE || "orbitar_db",
    dir: './backup-media',
    dbFile: './backup-media/index.csv'
};

const sleep = function(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

const download = async function(url, dest) {
  return new Promise((resolve) => {
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
          file.close();
          resolve(true);
        });
      }).on('error', function(err) {
        console.trace(err);
        fs.unlinkSync(dest);
        resolve(false);
      });
    } catch (e) {
      console.trace(e);
      resolve(false);
    }
  })
};

const saveEntry = function(mediaType, outputPath, outputFilename, mediaSrc, itemType, itemId) {
  let dimensions = {width: 0, height: 0};
  if (mediaType === MEDIA_TYPE_IMG) {
    try {
      dimensions = sizeOf(outputPath);
    } catch (e) {}
  }
  let line = [
    itemType, itemId, mediaType, mediaSrc, outputFilename, dimensions.width, dimensions.height
  ];
  fs.appendFileSync(config.dbFile, line.join(',') + "\n");
}

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

const processBatch = async (offset) => {
  const result = await connection.promise().query(
    'select * from `content_source` where `source` like "%<img%" or `source` like "%<video%" limit ' + offset + ',' + BATCH_SIZE
  );

  if (!result[0] || !result[0].length) {
    console.log('Done');
    process.exit(0);
  }

  for (let i = 0; i < result[0].length; i++) {
    let entry = result[0][i];
    let itemType = entry.ref_type;
    let itemId = entry.ref_id;
    let entrySource = entry.source;
    const mediaItems = entrySource.match(/<(img|source).+src=['"]([^'"]+)['"]/g);
    if (!mediaItems) {
      continue;
    }
    for (let ii = 0; ii < mediaItems.length; ii++) {
      const check = mediaItems[ii].match(/<(img|source).+src=['"]([^'"]+)['"]/);
      let mediaSrc = check[2];
      let mediaType = check[1] === MEDIA_TYPE_IMG ? MEDIA_TYPE_IMG : MEDIA_TYPE_VIDEO;
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
      if (fs.existsSync(outputPath)) {
        console.log(outputPath, 'is already there');
        saveEntry(mediaType, outputPath, outputFilename, mediaSrc, itemType, itemId);
        continue;
      }
      try {
        console.log(entrySource);
        console.log(`Downloading ${mediaSrc} to ${outputPath}`);
        if (await download(mediaSrc, outputPath)) {
          saveEntry(mediaType, outputPath, outputFilename, mediaSrc, itemType, itemId);
          console.log('Downloaded: ', mediaSrc);
        }
      } catch (e) {
        console.error('Failed to download: ', mediaSrc);
      }
    }
  }
  await sleep(SLEEP_BETWEEN_BATCHES_MS);
  await processBatch(offset + BATCH_SIZE);
}

(async () => {
  const result = await connection.promise().query(
    'select count(*) as total from `content_source` where `source` like "%<img%" or `source` like "%video%"'
  );
  console.log('Content sources with media: ', result[0][0].total);
  console.log('Start processing');
  await processBatch(0);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
