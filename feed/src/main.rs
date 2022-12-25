#![feature(test)]
#[macro_use]
#[allow(unused_imports)]
extern crate test;

#[macro_use]
extern crate nickel;

#[macro_use]
extern crate lazy_static;

#[macro_use]
extern crate serde_derive;

mod orbitar_index;

use std::collections::HashMap;
use std::sync::RwLock;
use serde_json;
use orbitar_index::idx::{get_posts_for_offset, Index};
use nickel::{Nickel, HttpRouter, JsonBody};
use crate::orbitar_index::idx::PostId;

#[derive(Serialize, Deserialize, Debug)]
struct Post {
    ts: usize,
    id: usize,
}

#[derive(Serialize, Deserialize, Debug)]
struct Batch {
    subsite: String,
    posts: Vec<Post>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Query {
    subsites: Vec<String>,
    offset: usize,
    limit: usize,
}

#[derive(Serialize, Deserialize, Debug)]
struct QueryResponse {
    post_ids: Vec<PostId>,
    total: usize,
    cache_is_empty: bool,
}


lazy_static! {
    static ref RWLOCK: RwLock<HashMap<String, Index>> = RwLock::new(HashMap::new());
}


fn main() {
    let mut server = Nickel::new();

    server.utilize(middleware! { |req|
        println!("request: {:?}", req.origin.uri);
    });

    server.get("/ping", middleware! {
        "pong"
    });

    server.post("/clear", middleware! {
        {
            let mut map = RWLOCK.write().unwrap();
            map.clear();
        }
        "OK"
    });

    server.post("/update", middleware! { |request|
        let batches: Vec<Batch> = request.json_as().unwrap();
        println!("batches: {:?}", batches);
        {
            let mut map = RWLOCK.write().unwrap();
            for batch in batches {
                let index = map.entry(batch.subsite).or_insert(Index::new(1));
                for post in batch.posts {
                    index.add((post.ts, post.id));
                }
            }
        }
        "OK"
    });

    server.post("/remove", middleware! { |request|
        let batches: Vec<Batch> = request.json_as().unwrap();
        println!("batches: {:?}", batches);
        {
            let mut map = RWLOCK.write().unwrap();
            for batch in batches {
                if let Some(index) = map.get_mut(&batch.subsite) {
                    for post in batch.posts {
                        index.remove(&(post.ts, post.id));
                    }
                }
            }
        }
        "OK"
    });

    server.post("/query", middleware! { |request|
        let query: Query = request.json_as().unwrap();
        println!("query: {:?}", query);
        let map = RWLOCK.read().unwrap();

        let subsite_indexes: Vec<&Index> =
            query.subsites.iter().filter_map(|subsite| map.get(subsite)).collect();

        let total = subsite_indexes.iter().map(|index| index.len()).sum::<usize>();
        let posts = get_posts_for_offset(&subsite_indexes, query.offset, query.limit);

        let response = QueryResponse {
            post_ids: posts,
            total: total,
            cache_is_empty: map.is_empty()
        };
        serde_json::to_string(&response).unwrap()
    });

    server.post("/total", middleware! { |request|
        let subsites: Vec<String> = request.json_as().unwrap();
        let map = RWLOCK.read().unwrap();

        // sum of all subsite counts
        let total = subsites.iter().filter_map(|subsite| map.get(subsite))
            .map(|i| i.len()).sum::<usize>();

        serde_json::to_string(&total).unwrap()
    });

    server.listen("0.0.0.0:6767").unwrap();
}