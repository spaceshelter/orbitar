delete from user_webpush;
update users set email='user@example.com';

update invites set code=md5(RANDOM_BYTES(128));
update sessions set id=sha1(RANDOM_BYTES(128));
