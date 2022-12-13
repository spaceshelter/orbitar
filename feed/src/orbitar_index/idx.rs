
use std::collections::HashMap;
use std::collections::BTreeSet;
use segment_tree::ops::Add;
use segment_tree::PrefixPoint;
use std::collections::binary_heap::BinaryHeap;

pub type PostId = usize;
pub type PostTS = usize; // timestamp of the post in seconds
pub type PS = PrefixPoint<i32, Add>;


// (the day of the year, id of the individual post)
pub type Post = (PostTS, PostId);

// posts index for an individual subsite
#[derive(Clone)]
pub struct Index {
    // count of posts per day
    counts: PS,
    // map of post ids to post keys
    posts: HashMap<PostId, PostTS>,
    // ordered set of post keys
    posts_by_day: BTreeSet<(PostTS, PostId)>,
}

impl Index {
    fn day_of_year(key: PostTS) -> usize {
        return key / 86400;
    }

    pub fn len(&self) -> usize {
        return self.posts.len();
    }

    pub fn new(size: usize) -> Self {
        Index {
            counts: PS::build(vec![0; size], Add),
            posts: HashMap::new(),
            posts_by_day: BTreeSet::new(),
        }
    }

    fn query_right(&self, key: usize) -> usize {
        if key >= self.counts.len() {
            return 0;
        }
        return self.posts.len() - self.counts.query(key) as usize;
    }

    pub fn remove(&mut self, post: &Post) {
        if let Some(key) = self.posts.remove(&post.1) {
            self.counts.modify(Index::day_of_year(key), -1);
            self.posts_by_day.remove(&(key, post.1));
        }
    }

    pub fn add(&mut self, post: Post) {
        self.remove(&post);
        self.posts.insert(post.1, post.0);
        let day = Index::day_of_year(post.0);
        if self.counts.len() <= day {
            self.counts.extend(vec![0; day - self.counts.len() + 1]);
        }
        self.counts.modify(Index::day_of_year(post.0), 1);
        self.posts_by_day.insert(post);
    }
}

fn offset_to_day<'a>(indexes: &'a Vec<&'a Index>, offset: usize) -> (usize, usize) {
    const LEEWAY: usize = 128;

    // max len
    let right = indexes.into_iter().map(|i| i.counts.len()).max().unwrap_or(0);

    if right == 0 || offset <= LEEWAY {
        return (right, 0);
    }

    let mut l = 0;
    let mut r = right;

    let offset_value = |m: usize|
        indexes.into_iter().map(|i| i.query_right(m)).sum::<usize>();

    while l < r {
        let m = (l + r) / 2;
        let mv = offset_value(m);

        if mv <= offset && mv + LEEWAY >= offset {
            return (m, mv);
        }

        if mv > offset {
            l = m + 1;
        } else {
            r = m;
        }
    }
    (l, offset_value(l))
}

pub fn get_posts_for_offset<'a>(indexes: &'a Vec<&'a Index>, offset: usize, len: usize) -> Vec<PostId> {
    let (day, prev_offset) = offset_to_day(indexes, offset);
    // calculate the first PostKey before the offset (convert day to PostKey)
    let first_key = (day + 1) * 86400;

    let mut iter_vec =
        indexes.into_iter().map(|ps| ps.posts_by_day.range(..(first_key, 0)).rev().peekable())
            .collect::<Vec<_>>();


    let mut q = BinaryHeap::new();
    for i in 0..iter_vec.len() {
        if let Some((key, id)) = iter_vec[i].peek() {
            q.push((key, id, i));
        }
    }

    let mut next_post = || {
        if let Some((key, id, i)) = q.pop() {
            iter_vec[i].next();
            if let Some((key, id)) = iter_vec[i].peek() {
                q.push((key, id, i));
            }
            Some((key, id))
        } else {
            None
        }
    };

    // skip the first offset posts
    for _ in 0..(offset - prev_offset) {
        next_post();
    }

    let mut posts = Vec::with_capacity(len);
    // get the next len posts
    for _ in 0..len {
        if let Some((_key, id)) = next_post() {
            posts.push(*id);
            // println!("post: {:?}", id);
        } else {
            break;
        }
    }

    return posts;
}

/// TEST
#[cfg(test)]
mod tests {
    use rand::{Rng, SeedableRng};
    use crate::orbitar_index::idx::{get_posts_for_offset, Index, PostId};
    use test;
    use bench;

    fn gen_ts(day: usize, sub_day: usize) -> usize {
        return day * 86400 + sub_day;
    }

    fn generate_random_indexes(seed:usize, num: usize, len_days: usize, posts_num: usize) -> Vec<Index> {
        let mut indexes = Vec::new();
        for _ in 0..num {
            indexes.push(Index::new(len_days));
        }

        // random from seed
        let mut rng = rand::rngs::StdRng::seed_from_u64(seed as u64);

        for i in 0..posts_num {
            // generate random day
            let day = rng.gen::<usize>() % len_days;
            let random_ts = gen_ts(day, i % 86400);

            // generate random post
            let post = (random_ts, i);
            let random_index = rng.gen::<usize>() % num;
            indexes[random_index].add(post);
        }

        return indexes;
    }

    #[test]
    fn test_indexes() {
        let mut indexes = Vec::new();
        let len = 1;
        indexes.push(Index::new(len));
        indexes.push(Index::new(len));

        let mut post_id = 0;
        let mut next_post_id = || {
            post_id += 1;
            post_id
        };

        indexes[0].add((gen_ts(0, 0), next_post_id()));
        indexes[1].add((gen_ts(0, 1), next_post_id()));
        indexes[0].add((gen_ts(0, 2), next_post_id()));
        indexes[0].add((gen_ts(1, 0), next_post_id()));
        indexes[0].add((gen_ts(1, 1), next_post_id()));
        indexes[0].add((gen_ts(1, 2), next_post_id()));
        indexes[1].add((gen_ts(1, 3), next_post_id()));
        indexes[1].add((gen_ts(1, 4), next_post_id()));
        indexes[0].add((gen_ts(1, 4), next_post_id()));
        indexes[0].add((gen_ts(1, 4), next_post_id()));
        indexes[0].add((gen_ts(1, 4), next_post_id()));
        indexes[1].add((gen_ts(1, 4), next_post_id()));
        indexes[1].add((gen_ts(1, 4), next_post_id()));
        indexes[1].add((gen_ts(5, 0), next_post_id()));
        indexes[1].add((gen_ts(5, 1), next_post_id()));
        indexes[1].add((gen_ts(5, 2), next_post_id()));
        indexes[1].add((gen_ts(5, 3), next_post_id()));
        indexes[1].add((gen_ts(5, 4), next_post_id()));
        indexes[0].add((gen_ts(6, 10), next_post_id()));
        indexes[0].add((gen_ts(6, 12), next_post_id()));
        indexes[0].add((gen_ts(6, 15), next_post_id()));
        indexes[0].add((gen_ts(6, 20), next_post_id()));

        assert_eq!(post_id, 22);

        let indexes = indexes.iter().map(|idx| idx).collect::<Vec<_>>();

        assert_eq!(get_posts_for_offset(&indexes, 0, 10), (post_id - 9..=post_id).rev().collect::<Vec<_>>());
        assert_eq!(get_posts_for_offset(&indexes, 0, 22), (1..=post_id).rev().collect::<Vec<_>>());
        assert_eq!(get_posts_for_offset(&indexes, 10, 10), (post_id - 9 - 10..=post_id - 10).rev().collect::<Vec<_>>());
        assert_eq!(get_posts_for_offset(&indexes, 20, 5), vec![post_id - 20, post_id - 21]);
    }

    #[test]
    fn test_edge_cases() {
        let mut indexes = Vec::new();
        let len = 1;
        indexes.push(Index::new(len));
        indexes.push(Index::new(len));
        let indexes = indexes.iter().map(|idx| idx).collect::<Vec<_>>();

        let empty: Vec<PostId> = vec![];
        // empty indexes
        assert_eq!(get_posts_for_offset(&indexes, 0, 10), empty);
        assert_eq!(get_posts_for_offset(&indexes, 12313, 10), empty);
        assert_eq!(get_posts_for_offset(&indexes, 12313, 0), empty);
        assert_eq!(get_posts_for_offset(&indexes, 12313, 0), empty);

        // copy from indexes
        let mut indexes = indexes.into_iter().map(|idx| idx.clone()).collect::<Vec<_>>();
        indexes[0].add((gen_ts(0, 0), 1));
        let indexes = indexes.iter().map(|idx| idx).collect::<Vec<_>>();
        assert_eq!(get_posts_for_offset(&indexes, 0, 10), vec![1]);
        assert_eq!(get_posts_for_offset(&indexes, 1, 10), empty);
        assert_eq!(get_posts_for_offset(&indexes, 12313, 0), empty);
    }

    #[test]
    fn test_correctness() {
        let num_indexes = 7;

        for len_days in vec![1, 10, 128, 365 * 10] {
            let mut indexes = Vec::new();
            for _ in 0..num_indexes {
                indexes.push(Index::new(len_days));
            }

            let posts_num = 2000;
            let mut eta = Vec::new();

            let mut rng = rand::rngs::StdRng::seed_from_u64(0);

            for i in 0..posts_num {
                // generate random day
                let day = rng.gen::<usize>() % len_days;
                let random_ts = gen_ts(day, i % 86400);
                let random_index = rng.gen::<usize>() % num_indexes;

                let post = (random_ts, i);

                indexes[random_index].add(post.clone());
                eta.push(post);
            }

            eta.sort();

            let indexes = indexes.iter().map(|idx| idx).collect::<Vec<_>>();

            for i in 0..posts_num {
                let posts = get_posts_for_offset(&indexes, i, 10);

                let eta_offset_left = (posts_num as i32 - i as i32 - 10).max(0) as usize;
                let eta_offset_right = (posts_num as i32 - i as i32).min(posts_num as i32) as usize;


                assert_eq!(posts, eta[eta_offset_left..eta_offset_right].iter().rev().map(|x| x.1).collect::<Vec<_>>(),
                           "len_days: {}, i: {}", len_days, i);
            }
        }
    }

    #[test]
    fn test_update() {
        // test after mutatiion of index we get correct results
        let mut indexes = Vec::new();
        indexes.push(Index::new(0));
        indexes.push(Index::new(0));

        let indexes = indexes.iter().map(|idx| idx).collect::<Vec<_>>();
        let eta = vec![
            (gen_ts(0, 0), 0, 1),
            (gen_ts(0, 1), 1, 2),
            (gen_ts(0, 2), 0, 3),
            (gen_ts(0, 3), 1, 4),
            (gen_ts(0, 4), 1, 5)];


        // update indexes with eta
        let mut indexes = indexes.into_iter().map(|idx| idx.clone()).collect::<Vec<_>>();
        for (ts, ss_id, post_id) in eta {
            indexes[ss_id].add((ts, post_id));
        }
        let indexes = indexes.iter().map(|idx| idx).collect::<Vec<_>>();
        // check that we get correct results
        assert_eq!(get_posts_for_offset(&indexes, 0, 10), vec![5, 4, 3, 2, 1]);
        assert_eq!(get_posts_for_offset(&indexes, 1, 10), vec![4, 3, 2, 1]);

        // mutate date
        let eta = vec![
            (gen_ts(0, 0), 1, 2),
            (gen_ts(0, 1), 0, 1),
            (gen_ts(0, 2), 1, 4),
            (gen_ts(0, 3), 0, 3),
            (gen_ts(0, 4), 1, 5)];

        // update indexes with eta
        let mut indexes = indexes.into_iter().map(|idx| idx.clone()).collect::<Vec<_>>();
        for (ts, ss_id, post_id) in eta {
            indexes[ss_id].add((ts, post_id));
        }
        let indexes = indexes.iter().map(|idx| idx).collect::<Vec<_>>();
        // check that we get correct results
        assert_eq!(get_posts_for_offset(&indexes, 0, 10), vec![5, 3, 4, 1, 2]);
        assert_eq!(get_posts_for_offset(&indexes, 1, 10), vec![3, 4, 1, 2]);
    }

    #[bench]
    fn bench_zero_offset(b: &mut test::Bencher) {
        // let indexes = generate_random_indexes(0, 100, 365 * 10, 10000000);
        let indexes = generate_random_indexes(0, 200, 365 * 10, 10000000);
        let indexes = indexes.iter().map(|idx| idx).collect::<Vec<_>>();

        b.iter(|| {
            // let offset = rand::random::<i32>() % 1000000;
            let offset = 0;
            get_posts_for_offset(&indexes, offset, 20);
        });
    }

    #[bench]
    fn bench_random_offset(b: &mut test::Bencher) {
        let post_num = 10000000;
        let indexes = generate_random_indexes(0, 500, 365 * 10, post_num);
        let indexes = indexes.iter().map(|idx| idx).collect::<Vec<_>>();

        let mut rng = rand::rngs::StdRng::seed_from_u64(0);

        b.iter(|| {
            let offset = rng.gen::<usize>() % post_num;
            get_posts_for_offset(&indexes, offset, 20);
        });
    }

}