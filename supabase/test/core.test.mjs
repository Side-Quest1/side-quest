import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration enforces isolation, host approval, capacity, blocks and chat membership", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;`);
    const folder = new URL("../migrations/", import.meta.url);
    for (const file of (await readdir(folder))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await db.exec(await readFile(new URL(file, folder), "utf8"));
    }
    const ids = [1, 2, 3, 4].map(
      (n) => "00000000-0000-4000-8000-00000000000" + n,
    );
    for (const [i, id] of ids.entries()) {
      await db.query("insert into auth.users values ($1)", [id]);
      await db.query(
        "insert into sidequest_private.age_checks(user_id,birth_date) values($1,current_date - $2::interval)",
        [id, i === 3 ? "17 years" : "25 years"],
      );
    }
    await db.exec("set role authenticated");
    const login = (id) =>
      db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await login(ids[0]);
    const {
      rows: [{ id: q }],
    } =
      await db.query(`insert into public.activities(title,description,area,starts_at,ends_at,capacity,join_mode)
      values('Walk','Group walk','Central',now()+interval '1 day',now()+interval '2 days',2,'approval') returning id`);
    const change = (action, target = null) =>
      db.query("select public.change_participation($1,$2,$3)", [
        q,
        action,
        target,
      ]);
    const send = () =>
      db.query(
        "insert into public.activity_messages(activity_id,body) values($1,'Hello')",
        [q],
      );
    await login(ids[3]);
    assert.equal(
      (await db.query("select id from public.activities")).rows.length,
      0,
    );
    await login(ids[1]);
    await change("join");
    await assert.rejects(send);
    const feed = async (options = {}, cursor = null, size = 12) =>
      (
        await db.query("select public.recommend_activities($1,$2,$3) as page", [
          JSON.stringify(options),
          cursor ? JSON.stringify(cursor) : null,
          size,
        ])
      ).rows[0].page;
    assert.deepEqual((await feed()).items, []);
    await login(ids[2]);
    await change("join");
    await assert.rejects(() => change("approve", ids[1]), /Host required/);
    await login(ids[0]);
    await change("approve", ids[1]);
    await assert.rejects(() => change("approve", ids[2]), /full/);
    await login(ids[1]);
    await send();
    await login(ids[0]);
    await db.query("insert into public.user_blocks(blocked) values($1)", [
      ids[1],
    ]);
    assert.equal(
      (await db.query("select * from public.activity_messages")).rows.length,
      0,
    );
    await login(ids[1]);
    await assert.rejects(send);
    assert.equal(
      (await db.query("select id from public.activities")).rows.length,
      0,
    );
    await login(ids[0]);
    const {
      rows: [{ id: privateId }],
    } =
      await db.query(`insert into public.activities(title,description,area,starts_at,ends_at,capacity,join_mode,visibility)
      values('Study','Library','North',now()+interval '30 minutes',now()+interval '2 hours',3,'instant','invite-only') returning id`);
    await login(ids[2]);
    assert.equal(
      (
        await db.query("select id from public.activities where id=$1", [
          privateId,
        ])
      ).rows.length,
      0,
    );
    assert.deepEqual((await feed()).items, []);
    await assert.rejects(
      () =>
        db.query("select public.change_participation($1,'join')", [privateId]),
      /Invitation required/,
    );
    await login(ids[0]);
    await db.query("insert into public.activity_invites values($1,$2)", [
      privateId,
      ids[2],
    ]);
    await login(ids[2]);
    await db.query("select public.change_participation($1,'join')", [
      privateId,
    ]);
    assert.equal(
      (
        await db.query(
          "select public.available_spots(a) as spots from public.activities a where id=$1",
          [privateId],
        )
      ).rows[0].spots,
      1,
    );
    await assert.rejects(()=>db.query("select public.check_in_activity($1)",[privateId]),/unavailable/);
    await assert.rejects(()=>db.query("select * from public.claim_push_work()"),/permission denied/);
    await db.query("insert into public.push_devices(token) values('ExpoPushToken[local_fixture]')");
    await db.exec("reset role;select sidequest_private.tick();select sidequest_private.tick();");
    const claim=(await db.query("select * from public.claim_push_work()")).rows;
    assert.equal(claim.length,1);
    assert.equal((await db.query("select * from public.claim_push_work()")).rows.length,0);
    await db.query("select public.finish_push_work($1,$2,'ticket','local-receipt')",[claim[0].id,claim[0].lease]);
    await db.query("update sidequest_private.push_deliveries set next_attempt=now() where id=$1",[claim[0].id]);
    const receipt=(await db.query("select * from public.claim_push_work()")).rows[0];
    assert.equal(receipt.ticket,"local-receipt");
    await db.query("select public.finish_push_work($1,$2,'delivered')",[receipt.id,receipt.lease]);
    assert.equal((await db.query("select count(*)::int n from sidequest_private.push_queue where delivered_at is not null")).rows[0].n,1);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from sidequest_private.reminders where activity_id=$1",
          [privateId],
        )
      ).rows[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});
