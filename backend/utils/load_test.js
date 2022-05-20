require('dotenv-flow').config();

const argparse = require('argparse');
const mysql = require('mysql2');

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
    description: 'Perform load tests on the database'
});
/* time */
parser.add_argument('-t', '--time', {
    help: 'Time to run the test, seconds',
    default: 5
});
/* number of concurrent users */
parser.add_argument('-u', '--users', {
    help: 'Number of concurrent users',
    default: 1
});
/* limit */
parser.add_argument('-l', '--limit', {
    help: 'Limit for the number of posts to be retrieved',
    default: 100
});
/* max page */
parser.add_argument('-p', '--page', {
    help: 'Max page number for posts to be retrieved (offset = page * limit)',
    default: 2
});
/* flag retrieve all */
parser.add_argument('-a', '--all', {
    help: 'Retrieve all post data',
    action: 'store_true',
    default: false
});

const args = parser.parse_args();
if (args.help) {
    parser.print_help();
    process.exit(0);
}

/**
 * Picks a random elemet from an array, returns undermined if array is empty
 * @param array
 * @return {*}
 */
function pick_random(array) {
    return array[Math.floor(Math.random() * array.length)];
}


async function main() {
    // connect to database
    const connPool = await mysql.createPool(db_config).promise();
    const conn = await connPool.getConnection();

    try {

        // get all users
        const users = (await conn.query(`SELECT distinct user_id
                                        FROM user_sites
                                        order by rand() limit ?`,  [parseInt(args.users)]))[0].map(user => user.user_id);

        if (users.length === 0) {
            console.log("No users found");
            return;
        }
        while (users.length < args.users) {
            users.push(...users);
        }
        users.length = args.users;

        const start_time = Date.now();

        const tasks = users.map(user => {
            return async () => {
                const conn = await connPool.getConnection();
                try {
                    let requests = 0;

                    while (start_time + args.time * 1000 > Date.now()) {
                        const subsites_ids = (await conn.query(`SELECT site_id
                                                               FROM user_sites
                                                               WHERE user_id = ?`, [user]))[0].map(site => site.site_id);

                        const offset = Math.floor(Math.random() * args.page) * args.limit;
                        await conn.query(`SELECT ${args.all ? '*' : 'post_id'}
                                                        from posts
                                                        where site_id in (?)
                                                        order by commented_at desc
                                                            limit ?, ?`,
                            [subsites_ids, offset, args.limit]
                        );

                        requests++;
                    }
                    return requests;
                } finally {
                    conn.release();
                }
            }
        });

        console.log(`Running ${args.users} concurrent users for ${args.time} seconds`);
        console.log(`Limit: ${args.limit} posts per page`);
        console.log(`Max page: ${args.page}`);
        console.log(`Retrieve all: ${args.all}`);
        const results = await Promise.all(tasks.map(task => task()));
        const total_requests = results.reduce((acc, requests) => acc + requests, 0);
        console.log(`Total requests: ${total_requests}`);
        console.log(`Requests per second: ${total_requests / args.time}`);

    } catch
        (err) {
        console.error(err);
    } finally {
        conn.release();
        await connPool.end();
    }
}

main();