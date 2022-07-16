require('dotenv-flow').config();

const argparse = require('argparse');
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');

const db_config = {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: "root",
    password: process.env.MYSQL_ROOT_PASSWORD || "orbitar",
    database: process.env.MYSQL_DATABASE || "orbitar_db",
    "multipleStatements": true
}

const parser = new argparse.ArgumentParser({
    add_help: true,
    description: 'Generate dummy data for Orbitar'
});
parser.add_argument('-u', '--users', {
    help: 'Number of users to generate',
    default: 0
});
parser.add_argument('-s', '--subsites', {
    help: 'Number of subsites to generate',
    default: 0
});
parser.add_argument('-p', '--posts', {
    help: 'Number of posts to generate',
    default: 0
});
parser.add_argument('-c', '--comments', {
    help: 'Number of comments to generate',
    default: 0
});
parser.add_argument('-f', '--fish', {
    help: 'Use FishText API to generate texts',
    default: 0
});

const args = parser.parse_args();
if (args.help) {
    parser.print_help();
    process.exit(0);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates random text using fish-text.ru API
 * @param isHeader true if you need a header (short string)
 */
async function generate_random_text_with_fish_text_api(isHeader) {
    const response = await fetch(`https://fish-text.ru/get?type=${isHeader ? 'title' : 'paragraph'}`);
    let jsonData = await response.json();
    if (!jsonData || jsonData.status !== 'success' ) {
        throw new Error('Request to fish-text failed');
    }
    await sleep(300);
    return jsonData.text.replace(/\\n/g, "<br/>");
}

/**
 * Picks a random elemet from an array, returns undermined if array is empty
 * @param array
 * @return {*}
 */
function pick_random(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generates a random string of a given length
 * @param length
 * @return {string}
 */
async function generate_random_string(length) {
    if (args.fish) {
        return await generate_random_text_with_fish_text_api(length < 50);
    }
    let result = [];
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789   ';
    for (let i = 0; i < length; i++) {
        result.push(characters.charAt(Math.floor(Math.random() * characters.length)));
    }
    return result.join('');
}

/**
 * Generates a random date between 2019-01-01 and current date
 * @return {Date}
 */
function get_random_date() {
    const start = new Date(2019, 0, 1);
    const end = new Date();
    const randomDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return randomDate;
}

async function main() {
    // connect to database
    const connection = await mysql.createConnection(db_config);
    connection.config.namedPlaceholders = true;

    try {
        const posts_num = (await connection.query('SELECT COUNT(*) AS num FROM posts'))[0][0].num;
        console.log(`Found ${posts_num} posts`);

        // existing user ids:
        const existing_user_ids = (await connection.query('SELECT user_id FROM users ORDER BY user_id ASC'))[0].map(user => user.user_id);
        console.log(`Found ${existing_user_ids.length} existing users`);

        // create users
        if (args.users > 0) {
            console.log(`Generating ${(args.users)} users`);
            const max_user_id = existing_user_ids[existing_user_ids.length - 1] || 0;

            for (let i = 0; i < args.users; i++) {
                const user_id = max_user_id + i + 1;
                const query = "INSERT INTO users (username, password, email, name) VALUES (:username, :password, :email, :name)";
                const params = {
                    username: `user${user_id}`,
                    password: `password${user_id}`,
                    email: `user${user_id}@test.com`,
                    name: `User ${user_id}`
                };
                const inserted_id = (await connection.execute(query, params))[0].insertId;
                existing_user_ids.push(inserted_id);
            }

            console.log(`Generated ${(args.users)} users`);
        }

        // existing site ids:
        const existing_site_ids = (await connection.query('SELECT site_id FROM sites ORDER BY site_id ASC'))[0].map(site => site.site_id);
        console.log(`Found ${existing_site_ids.length} existing sites`);

        // create sites
        if (args.subsites > 0) {
            console.log(`Generating ${(args.subsites)} subsites`);
            const max_site_id = existing_site_ids[existing_site_ids.length - 1] || 0;

            for (let i = 0; i < args.subsites; i++) {
                const site_id = max_site_id + i + 1;
                const query = "INSERT INTO sites (subdomain, name, owner_id) VALUES (:subdomain, :name, :owner_id)";
                const params = {
                    subdomain: `subsite${site_id}`,
                    name: `Subsite ${site_id}`,
                    owner_id: pick_random(existing_user_ids)
                };
                inserted_id = (await connection.execute(query, params))[0].insertId;
                existing_site_ids.push(inserted_id);
            }
            console.log(`Generated ${(args.subsites)} subsites`);
        }

        // existing post ids:
        const existing_post_ids = (await connection.query('SELECT post_id FROM posts ORDER BY post_id ASC'))[0].map(post => post.post_id);
        console.log(`Found ${existing_post_ids.length} existing posts`);

        // create posts
        if (args.posts > 0) {
            console.log(`Generating ${(args.posts)} posts`);
            const max_post_id = existing_post_ids[existing_post_ids.length - 1] || 0;

            for (let i = 0; i < args.posts; i++) {
                const post_id = max_post_id + i + 1;
                const query = "INSERT INTO posts (site_id, author_id, rating, title, source, html) VALUES (:site_id, :author_id, :rating, :title, :source, :html)";
                const params = {
                    site_id: pick_random(existing_site_ids),
                    author_id: pick_random(existing_user_ids),
                    rating: Math.floor(Math.random() * 5),
                    title: await generate_random_string(Math.floor(Math.random() * 20) + 5),
                    source: await generate_random_string(Math.floor(Math.random() * 2000) + 20),
                    html: await generate_random_string(Math.floor(Math.random() * 2000) + 100)
                }
                inserted_id = (await connection.execute(query, params))[0].insertId;
                existing_post_ids.push(inserted_id);
            }
        }

        // existing comment ids:
        const existing_comments_count = (await connection.query('SELECT COUNT(*) AS count FROM comments'))[0][0].count;
        console.log(`Found ${existing_comments_count} existing comments`);

        // create comments
        if (args.comments > 0) {
            console.log(`Generating ${(args.comments)} comments`);
            const comment_batch_size = Math.max(10, Math.floor(args.comments / existing_post_ids.length));

            let i = 0;
            while (i < args.comments) {
                // create comments into post
                const post_id = pick_random(existing_post_ids);
                const post_site_id = (await connection.query('SELECT site_id FROM posts WHERE post_id = ?', [post_id]))[0][0].site_id;
                const post_comment_ids = (await connection.query(`SELECT comment_id FROM comments WHERE post_id = ${post_id}`))[0].map(comment => comment.comment_id);

                console.log(`Generating ${comment_batch_size} comments for post ${post_id} (subsite:${post_site_id}) with ${post_comment_ids.length} existing comments`);

                for (let j = 0; j < comment_batch_size && i < args.comments; j++, i++) {
                    const query = "INSERT INTO comments (post_id, parent_comment_id, created_at, author_id, `source`, html, rating, site_id) VALUES (:post_id, :parent_comment_id, :created_at, :author_id, :source, :html, :rating, :site_id)";
                    const params = {
                        post_id: post_id,
                        parent_comment_id: pick_random(post_comment_ids) || null,
                        created_at: get_random_date().toISOString().slice(0, 19).replace('T', ' '),
                        author_id: pick_random(existing_user_ids),
                        source: await generate_random_string(Math.floor(Math.random() * 1000) + 20),
                        html: await generate_random_string(Math.floor(Math.random() * 1000) + 100),
                        rating: Math.floor(Math.random() * 5),
                        site_id: post_site_id
                    }
                    const inserted_id = (await connection.execute(query, params))[0].insertId;
                    post_comment_ids.push(inserted_id);
                }
            }

            console.log(`Generated ${i} comments`);
        }

    } catch
        (err) {
        console.error(err);
    } finally {
        connection.end();
    }
}

main();