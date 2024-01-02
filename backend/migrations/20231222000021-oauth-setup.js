'use strict';

var dbm;
var type;
var seed;

exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function(db) {
  await db.runSql(`
    create table if not exists oauth_clients (
        id int auto_increment primary key,
        name varchar(32) unique not null,
        description varchar(255),
        logo_url varchar(255) default null,
        client_id varchar(255) unique not null,
        client_secret_hash varchar(255) not null,
        initial_authorization_url varchar(255) default null,
        redirect_urls text not null,
        grants varchar(255),
        user_id int not null,
        is_public tinyint(1) not null default 0,
        foreign key (user_id) references users(user_id) on delete cascade
    ) engine=InnoDB default charset=utf8mb4;

    create table if not exists oauth_tokens (
      access_token_hash varchar(64) not null,
      access_token_expires_at datetime,
      refresh_token_hash varchar(64) unique,
      client_id int not null,
      user_id int not null,
      scope varchar(255),
      revoked tinyint(1) not null default 0,
      foreign key (client_id) references oauth_clients(id) on delete cascade,
      foreign key (user_id) references users(user_id)  on delete cascade
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;

    create table if not exists oauth_consents (
      user_id int not null,
      client_id int not null,
      scope varchar(255),
      primary key (user_id, client_id),
      foreign key (user_id) references users(user_id) on delete cascade,
      foreign key (client_id) references oauth_clients(id) on delete cascade
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;
    
    create table if not exists oauth_codes (
      user_id int not null,
      client_id int not null,
      code varchar(255) unique not null,
      scope varchar(255) not null,
      redirect_url varchar(255) not null,
      expires_at datetime,
      foreign key (user_id) references users(user_id) on delete cascade,
      foreign key (client_id) references oauth_clients(id) on delete cascade
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;
    
  `);

  return null;
};

exports.down = async function(db) {
  await db.dropTable('oauth_consents');
  await db.dropTable('oauth_tokens');
  await db.dropTable('oauth_clients');
  return null;
};

exports._meta = {
  "version": 1
};
