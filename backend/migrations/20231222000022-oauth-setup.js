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
        client_id varchar(255) unique not null,
        client_secret_hash varchar(255) not null,
        name varchar(32) unique not null,
        description varchar(255),
        logo_url varchar(255) default null,
        initial_authorization_url varchar(255) default null,
        redirect_uris text not null,
        grants varchar(255),
        user_id int not null,
        foreign key (user_id) references users(user_id) on delete cascade
    ) engine=InnoDB default charset=utf8mb4;

    create table if not exists oauth_consents (
      user_id int not null,
      client_id varchar(255) not null,
      scope text,
      last_revoked_ts datetime default null,
      primary key (user_id, client_id),
      foreign key (user_id) references users(user_id) on delete cascade,
      foreign key (client_id) references oauth_clients(client_id) on delete cascade
    ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_general_ci;
    
  `);

  return null;
};

exports.down = async function(db) {
  await db.dropTable('oauth_clients');
  await db.dropTable('oauth_consents');
  return null;
};

exports._meta = {
  "version": 1
};
