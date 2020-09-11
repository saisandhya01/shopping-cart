# shopping-cart

Full Stack Shopping Website

Create the following tables in MySQL database:

create table users (id int primary key auto_increment,username varchar(255),email varchar(255),password varchar(255),usertype varchar(255));
create table items (id int primary key auto_increment,name varchar(255),description text, price int3,quantity int,soldBy varchar(255),image varchar(255) not null default '');
create table buyers (username varchar(255),cart varchar(2000) not null default '',purchases varchar(2000) not null default '');
create table sellers (username varchar(255),orders varchar(2000) not null default '');
