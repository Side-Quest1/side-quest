import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("recommendations rank eligible private data and retain stable, owner-bound pages", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;`);
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(f, dir), "utf8"));
  const [me, host, other, minor] = [1, 2, 3, 4].map(
    (i) => "00000000-0000-0000-0000-00000000000" + i,
  );
  for (const id of [me, host, other, minor]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query(
      "insert into sidequest_private.age_checks(user_id,birth_date) values($1,current_date-$2::interval)",
      [id, id === minor ? "17 years" : "30 years"],
    );
  }
  const create = async (
    title,
    category,
    who,
    cost = 0,
    lat = 12,
    start = "2037-01-03T20:00:00Z",
    visibility = "public",
  ) =>
    (
      await db.query(
        `insert into public.activities(title,description,category,host_id,area,starts_at,ends_at,capacity,join_mode,cost_inr,latitude,longitude,visibility,created_at)
    values($1,'At the park',$2,$3,'Central',$6::timestamptz,$6::timestamptz+interval '1 hour',4,'instant',$4,$5,77,$7,'2026-01-01') returning id`,
        [title, category, who, cost, lat, start, visibility],
      )
    ).rows[0].id;
  const close = await create("Football practice", "sports", host);
  const far = await create("Team training", "sports", host, 300, 25);
  const coffee = await create(
    "Coffee",
    "food",
    other,
    30,
    12,
    "2037-01-04T20:00:00Z",
  );
  await create("Private", "food", host, 0, 12, undefined, "invite-only");
  await create("Teen session", "sports", minor);
  await create("Finished", "sports", host, 0, 12, "2020-01-01T00:00:00Z");
  const full = await create("Full", "social", host);
  await db.query("update public.activities set capacity=2 where id=$1", [full]);
  await db.query("insert into public.participations values($1,$2,'accepted')", [
    full,
    other,
  ]);
  const login = (id) =>
    db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
  await login(me);
  const page = async (options = {}, next = null, size = 20) =>
    (
      await db.query("select public.recommend_activities($1,$2,$3) p", [
        JSON.stringify(options),
        next && JSON.stringify(next),
        size,
      ])
    ).rows[0].p;
  const rank = async () => (await page({ timezone: "Asia/Kolkata" })).items;
  const record = (q, k) =>
    db.query("select public.record_discovery($1,$2)", [q, k]);
  const cold = await rank();
  assert.deepEqual(
    new Set(cold.map((a) => a.id)),
    new Set([close, far, coffee]),
  );
  assert.equal(
    cold[1].category === "food" || cold[0].category === "food",
    true,
  );
  assert.ok(cold.every((a) => a.reason === "Upcoming with space to join."));
  await record(close, "impression");
  assert.deepEqual(
    (await db.query("select * from public.discovery_interactions")).rows,
    [],
  );
  await db.query(
    "insert into public.account_profiles(display_name,interests) values('Me',array['football'])",
  );
  await db.query(
    "insert into public.discovery_preferences(learn,categories,budget,weekdays,radius_km,latitude,longitude) values(true,array['sports'],40,array[0],10,12,77)",
  );
  const ranked = await rank();
  assert.equal(ranked[0].id, close);
  assert.match(ranked[0].reason, /football/i);
  const score = (rows, id) => rows.find((a) => a.id === id).score;
  const measure = async (sql, id) => {
    const before = score(await rank(), id);
    await db.exec(sql);
    return score(await rank(), id) - before;
  };
  assert.ok(
    (await measure(
      "update public.discovery_preferences set categories='{}'",
      far,
    )) < -0.09,
  );
  assert.ok(
    (await measure("update public.discovery_preferences set budget=500", far)) >
      0.08,
  );
  assert.ok(
    (await measure(
      "update public.discovery_preferences set latitude=25",
      far,
    )) > 0.14,
  );
  assert.ok(
    (await measure(
      "update public.discovery_preferences set weekdays='{}'",
      close,
    )) < -0.07,
  );
  assert.deepEqual(
    (await page({ distance: "10" })).items.map((a) => a.id),
    [far],
  );
  assert.deepEqual(
    (await page({ budget: "0", category: "sports" })).items.map((a) => a.id),
    [close],
  );
  const first = await page({}, null, 1);
  await login(other);
  await assert.rejects(() => page({}, first.next, 1), /Refresh/);
  await login(me);
  const second = await page({}, first.next, 1);
  const third = await page({}, second.next, 1);
  assert.equal(
    new Set([first, second, third].map((p) => p.items[0].id)).size,
    3,
  );
  assert.equal(third.next, null);
  const s = score(await rank(), coffee);
  await record(coffee, "save");
  assert.ok(score(await rank(), coffee) > s);
  await record(coffee, "impression");
  await record(coffee, "impression");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.discovery_interactions where kind='impression'",
      )
    ).rows[0].n,
    1,
  );
  await record(coffee, "dismiss");
  assert.ok(!(await rank()).some((a) => a.id === coffee));
  await db.exec("select public.clear_discovery_history()");
  assert.ok((await rank()).some((a) => a.id === coffee));
  await db.query("insert into public.user_blocks(blocked) values($1)", [host]);
  assert.deepEqual(
    (await rank()).map((a) => a.id),
    [coffee],
  );
  await login(host);
  assert.deepEqual(
    (await db.query("select * from public.discovery_preferences")).rows,
    [],
  );
  await db.exec("reset role");
  await db.query(
    `insert into public.activities(host_id,title,description,area,starts_at,ends_at,capacity,join_mode)
    select $1,'Walk '||n,'Walk','Central',now()+interval '1 day'+n*interval '1 minute',now()+interval '2 days',8,'instant' from generate_series(1,1000)n`,
    [other],
  );
  await db.exec("set role authenticated");
  await login(me);
  const timings = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    assert.equal((await page()).items.length, 20);
    timings.push(Math.round(performance.now() - start));
  }
  t.diagnostic(
    "1000 additional activities, first-page PostgreSQL WASM milliseconds: " +
      timings.join(", "),
  );
});
