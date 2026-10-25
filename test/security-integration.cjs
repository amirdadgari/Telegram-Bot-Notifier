// Run inside the production candidate on home-docker, with no external network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const sqlite = require('sqlite3');
const bcrypt = require('bcryptjs');
const realFetch = global.fetch;
const calls = [];
function telegram(url, payload) {
  assert.match(url, /^https:\/\/api\.telegram\.org\/botfixture-bot-[ab]\/sendMessage$/);
  calls.push({url, payload});
  return {ok:true, result:{message_id:calls.length}};
}
require('axios').post = async (url, payload) => ({data:telegram(url,payload)});
global.fetch = async (url, options) => ({ok:true,json:async()=>telegram(url,JSON.parse(options.body))});
process.env.NODE_ENV='production';
process.env.PORT='3000';
process.env.SESSION_SECRET='security-fixture-only-'.repeat(4);
process.env.ADMIN_PASSWORD='fixture-admin-password';
process.env.TRUST_PROXY='loopback';
process.env.DATABASE_PATH='/tmp/webhook-security-fixture.db';
fs.rmSync(process.env.DATABASE_PATH,{force:true});
require('../app.js');
const db = new sqlite.Database(process.env.DATABASE_PATH);
const run = (q,p=[]) => new Promise((ok,no)=>db.run(q,p,function(e){e?no(e):ok(this)}));
const all = (q,p=[]) => new Promise((ok,no)=>db.all(q,p,(e,r)=>e?no(e):ok(r)));
async function req(path,body,cookie,extra={}) {
  return realFetch('http://127.0.0.1:3000'+path,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(cookie?{cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
}
(async()=>{
  for(let n=0;n<100;n++) {
    try { if((await req('/health')).status===200 && (await all('SELECT * FROM users')).length)break; }catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  const health=await req('/health');assert.equal(health.status,200);assert.equal(health.headers.get('x-powered-by'),null);
  const login=async(name,extra={})=>{
    const r=await req('/login',{username:name,password:name==='admin'?'fixture-admin-password':'fixture-user-password'},null,extra);
    assert.equal(r.status,302);return r.headers.get('set-cookie');
  };
  const admin=await login('admin');assert.match(admin,/HttpOnly/);assert.match(admin,/SameSite=Lax/);
  assert.match(await login('admin',{'x-forwarded-proto':'https'}),/Secure/);
  for(const name of ['alice','bob'])assert.equal((await req('/users',{username:name,password:'fixture-user-password'},admin)).status,302);
  const users=await all('SELECT id,username FROM users');
  const aid=users.find(x=>x.username==='alice').id,bid=users.find(x=>x.username==='bob').id;
  const a=await login('alice'),b=await login('bob');
  assert.equal((await req('/login')).status,200);
  for(const page of ['/dashboard','/tokens','/bots','/users','/change-password'])assert.equal((await req(page,undefined,admin)).status,200,page);
  assert.equal((await req('/users',undefined,a)).status,403);
  await run('INSERT INTO telegram_bots(id,user_id,bot_token,chat_id,bot_name) VALUES(101,?,\'fixture-bot-a\',\'fixture-a\',\'Alice bot\'),(102,?,\'fixture-bot-b\',\'fixture-b\',\'Bob bot\')',[aid,bid]);
  await req('/tokens',{name:'Alice token',botIds:[101,102]},a);
  await req('/tokens',{name:'Bob token',botIds:[102]},b);
  const tokens=await all('SELECT * FROM tokens ORDER BY id');const at=tokens[0],bt=tokens[1];
  assert.deepEqual((await all('SELECT bot_id FROM token_bot_assignments WHERE token_id=?',[at.id])).map(x=>x.bot_id),[101]);
  const before=await all('SELECT * FROM token_bot_assignments WHERE token_id=?',[bt.id]);
  assert.equal((await req(`/tokens/${bt.id}/edit`,{name:'intrusion',botIds:[101]},a)).status,404);
  assert.deepEqual(await all('SELECT * FROM token_bot_assignments WHERE token_id=?',[bt.id]),before);
  assert.equal((await req(`/bots/102/edit`,undefined,a)).status,404);
  await run('INSERT INTO token_bot_assignments(token_id,bot_id) VALUES(?,102)',[at.id]);
  const edit=await (await req(`/tokens/${at.id}/edit`,undefined,a)).json();assert.deepEqual(edit.assignedBotIds,[101]);
  const listing=await (await req('/tokens',undefined,a)).text();assert(!listing.includes('Bob bot'));
  assert.equal((await req('/api/send',{message:'fixture'})).status,401);
  assert.equal((await req('/api/send',{message:'fixture'},null,{authorization:'Bearer invalid'})).status,401);
  assert.equal((await req('/api/send',{},null,{authorization:'Bearer '+at.token})).status,400);
  for(const location of ['header','query','body']) {
    await run('UPDATE tokens SET auth_location=? WHERE id=?',[location,at.id]);
    const body={message:'fixture only'};if(location==='body')body.api_key=at.token;
    const path='/api/send'+(location==='query'?'?api_key='+at.token:'');
    const headers=location==='header'?{authorization:'Bearer '+at.token}:{};
    const result=await(await req(path,body,null,headers)).json();assert.equal(result.results.length,1);assert.equal(result.results[0].success,true);
    if(location!=='header')assert.equal((await req('/api/send',{message:'fixture'},null,{authorization:'Bearer '+at.token})).status,401);
  }
  assert(calls.every(x=>x.payload.chat_id==='fixture-a'));
  await run("UPDATE tokens SET auth_location='header' WHERE id=?",[at.id]);
  await run("UPDATE telegram_bots SET paused_enabled=1,paused_start_time='00:00',paused_end_time='23:59' WHERE id=101");
  const count=calls.length;const paused=await(await req('/api/send',{message:'fixture'},null,{authorization:'Bearer '+at.token})).json();assert.equal(paused.results[0].skipped,true);assert.equal(calls.length,count);
  await run("UPDATE telegram_bots SET paused_enabled=0,silent_enabled=1,silent_start_time='00:00',silent_end_time='23:59' WHERE id=101");
  await req('/api/send',{message:'fixture'},null,{authorization:'Bearer '+at.token});assert.equal(calls.at(-1).payload.disable_notification,true);
  assert.equal((await(await req(`/tokens/${at.id}/test`,{},a)).json()).success,true);
  assert.equal(calls.at(-1).payload.chat_id,'fixture-a');
  assert.equal((await(await req('/bots/test',{bot_token:'fixture-bot-a',chat_id:'fixture-a'},a)).json()).success,true);
  assert.equal((await all('PRAGMA integrity_check'))[0].integrity_check,'ok');
  console.log(JSON.stringify({status:'passed',users:users.length,authorization:true,templates:true,cookies:true,apiLocations:3,scheduling:true,mockedTelegramCalls:calls.length,sqlite:(await all('SELECT sqlite_version() AS v'))[0].v}));
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
