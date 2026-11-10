import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
test('series deletion removes only a confirmed year and preserves all other history',async()=>{
 const db=new PGlite();
 const owner='11111111-1111-4111-8111-111111111111',host='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
 const event='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table public.bourbon_profiles(id uuid primary key references auth.users(id),status text,role text);");
  for(const name of ['202611070001_events.sql','20261108211509_confirmed_event_deletion.sql','20261110014929_event_series_and_photos.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec('grant select on bourbon_profiles to service_role;');
  await db.query('insert into auth.users values($1),($2),($3)',[owner,host,other]);
  await db.query("insert into bourbon_profiles values($1,'active','owner'),($2,'active','member'),($3,'active','member')",[owner,host,other]);
  const series=(await db.query<{id:string}>("insert into bourbon_series(owner_id,title) values($1,'Yorktown') returning id",[host])).rows[0].id;
  await db.query('insert into bourbon_events(id,owner_id,state) values($1,$2,$3)',[event,host,JSON.stringify({id:event,ownerId:host,title:'Yorktown 2022',revision:0})]);
  const linked=(await db.query<{id:string}>('insert into bourbon_editions(series_id,year,event_id) values($1,2022,$2) returning id',[series,event])).rows[0].id;
  const historical=(await db.query<{id:string}>("insert into bourbon_editions(series_id,year,historical_entries) values($1,2021,'[]') returning id",[series])).rows[0].id;
  await db.query("insert into bourbon_editions(series_id,year,historical_entries) values($1,2020,'[]')",[series]);
  await assert.rejects(db.query('select delete_bourbon_event($1,$2,0,$3)',[event,owner,'Yorktown 2022']),/foreign key/);
  await db.exec(await readFile(new URL('../supabase/migrations/20261110133516_series_event_deletion.sql',import.meta.url),'utf8'));
  const removeHistory=async(id:string,actor:string,revision=0,year=2021,title='Yorktown')=>(await db.query<{removed:boolean}>('select delete_bourbon_historical_edition($1,$2,$3,$4,$5,$6) as removed',[id,series,actor,revision,year,title])).rows[0].removed;
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(removeHistory(historical,owner),/permission denied/);await db.exec('reset role');}
  await db.exec('set role service_role');
  assert.equal(await removeHistory(historical,other),false);
  assert.equal(await removeHistory(historical,owner,1),false);
  assert.equal(await removeHistory(historical,owner,0,2020),false);
  assert.equal(await removeHistory(historical,owner,0,2021,'Wrong title'),false);
  assert.equal(await removeHistory(linked,owner,0,2022),false);
  assert.equal((await db.query<{removed:boolean}>('select delete_bourbon_event($1,$2,0,$3) as removed',[event,other,'Yorktown 2022'])).rows[0].removed,false);
  assert.equal((await db.query<{removed:boolean}>('select delete_bourbon_event($1,$2,0,$3) as removed',[event,owner,'Yorktown 2022'])).rows[0].removed,true);
  assert.equal((await db.query('select * from bourbon_editions where id=$1',[linked])).rows.length,0);
  assert.equal(await removeHistory(historical,host),true);
  assert.equal(await removeHistory(historical,owner),false);
  assert.equal((await db.query('select * from bourbon_series')).rows.length,1);
  assert.deepEqual((await db.query('select year from bourbon_editions')).rows,[{year:2020}]);
 }finally{await db.close();}
});
