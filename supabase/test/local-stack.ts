import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { RecommendationService, SupabaseQuestRepository } from "@sidequest/adapters";

// Integration credentials are only accepted for a disposable loopback stack.
async function main(){
  const url=process.env.SIDEQUEST_QA_URL,key=process.env.SIDEQUEST_QA_ANON_KEY,container=process.env.SIDEQUEST_QA_DB;
  if(url!=="http://127.0.0.1:55821" || !key || !container || !/^supabase_db_sidequest-verify-[a-f0-9]{8}$/.test(container))throw Error("Configure the isolated local QA stack.");
  async function account(){
    const db=createClient(url!,key!,{auth:{persistSession:false,autoRefreshToken:false}});
    const id=randomUUID(),password=randomUUID()+"A1!";
    const {data,error}=await db.auth.signUp({email:"qa-"+id+"@example.test",password});
    if(error)throw error;
    assert.ok(data.session && data.user,"Local Auth must issue a session without external SMTP.");
    assert.match(data.user.id,/^[a-f0-9-]{36}$/);
    execFileSync("docker",["exec",container!,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-c",
      "insert into sidequest_private.age_checks(user_id,birth_date) values('"+data.user.id+"',current_date-interval '24 years')"]);
    return {db,id:data.user.id,repo:new SupabaseQuestRepository(db)};
  }
  const host=await account(),guest=await account(),third=await account();
  const title="Integration "+randomUUID();
  const id=await host.repo.save({title,description:"Local test",area:"Central",latitude:12.98,longitude:77.59,
    starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+90000000).toISOString(),
    capacity:2,join_mode:"approval",category:"adventure",activity_type:"outdoor",visibility:"public",requirements:"",type_notes:"",team_size:null,cost_inr:0});
  const service=new RecommendationService(guest.db);
  const feed=await service.page({search:title,timezone:"Asia/Kolkata"});
  assert.equal(feed.items[0].id,id);
  await Promise.all([guest.repo.participate(id,"join"),third.repo.participate(id,"join")]);
  const mine=await guest.repo.discover({search:"",budget:"",category:"",pages:1,mine:guest.id,group:"Pending"});
  assert.ok(mine.some(a=>a.id===id));
  const decisions=await Promise.allSettled([host.repo.participate(id,"approve",guest.id),host.repo.participate(id,"approve",third.id)]);
  assert.equal(decisions.filter(d=>d.status==="fulfilled").length,1);
  const joined=decisions[0].status==="fulfilled"?guest:third;
  const activity=await joined.repo.byId(id);
  assert.equal(activity?.available_spots,0);
  const channel=host.db.channel("qa-chat-"+id);
  await host.db.realtime.setAuth((await host.db.auth.getSession()).data.session!.access_token);
  let replicationReady!:()=>void;
  const replication=new Promise<void>(resolve=>{replicationReady=resolve;});
  channel.on("system",{},event=>{if(event.extension==="postgres_changes" && event.status==="ok")replicationReady();});
  let received!:()=>void;
  const inserted=new Promise<void>(resolve=>{received=resolve;});
  const until=(p:Promise<void>,label:string)=>new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error(label+" timed out")),15000);
    p.then(()=>{clearTimeout(timer);resolve();},e=>{clearTimeout(timer);reject(e);});
  });
  try{
    await until(new Promise<void>((resolve,reject)=>channel.on("postgres_changes",{event:"INSERT",schema:"public",table:"activity_messages",filter:"activity_id=eq."+id},()=>received()).subscribe(s=>{
      if(s==="SUBSCRIBED")resolve();else if(s==="CHANNEL_ERROR")reject(Error("Realtime subscription failed"));
    })),"Realtime subscription");
    await until(replication,"Postgres Changes registration");
    await joined.repo.send(id,"At the meeting point");
    await until(inserted,"Realtime chat delivery");
  }finally{await host.db.removeChannel(channel);await host.db.realtime.disconnect();}
  assert.equal((await host.repo.messages(id)).at(-1)?.body,"At the meeting point");
  const {data:alerts,error}=await host.db.from("activity_alerts").select("body").eq("activity_id",id);
  assert.ifError(error);assert.ok(alerts?.length);
  await host.repo.participate(id,"cancel");
  assert.equal((await service.page({search:title})).items.length,0);
  console.log("PASS local Supabase Auth and PostgREST: three sessions, verified fixtures, recommendations, pending refresh, concurrent approval, capacity, chat, alerts and cancellation.");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e instanceof Error?e.message:e?.message??"Local stack integration failed.");process.exit(1);});
