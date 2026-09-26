import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Runs the real migration on an in-process Postgres with a minimal stand-in for
// Supabase's auth schema, then checks that users are fully isolated by RLS.

const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

let db: PGlite;

const as = async <T = any>(user: string, sql: string, params: unknown[] = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role;');
  }
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant usage on schema public to authenticated, anon;
    insert into auth.users values ('${ALICE}'), ('${BOB}');
  `);
  await db.exec('create role service_role nologin bypassrls; grant usage on schema public to service_role;');
  for (const f of ['20260926000000_init.sql', '20260926010000_google_and_usage.sql']) {
    await db.exec(readFileSync(resolve(__dirname, '../supabase/migrations', f), 'utf8'));
  }
  await db.exec('grant all on all tables in schema public to service_role; grant execute on all functions in schema public to service_role;');
});

describe('customers RLS', () => {
  it('owner_id defaults to the signed-in user and rows are private', async () => {
    await as(ALICE, `insert into customers (id, name, company, status, next_action) values ('c1', 'A', 'Acme', 'Lead', '{"description":"call","dueDate":"2026-10-01"}')`);
    await as(BOB, `insert into customers (id, name, company, status) values ('c1', 'B', 'Beta', 'Prospect')`);

    const alice = await as(ALICE, 'select owner_id, name, next_action_due::text as due from customers');
    expect(alice).toEqual([{ owner_id: ALICE, name: 'A', due: '2026-10-01' }]);
    const bob = await as(BOB, 'select name from customers');
    expect(bob).toEqual([{ name: 'B' }]);
  });

  it('cannot update or delete another user\'s rows', async () => {
    await as(BOB, `update customers set name = 'hacked' where owner_id = '${ALICE}'`);
    await as(BOB, `delete from customers where owner_id = '${ALICE}'`);
    expect(await as(ALICE, 'select name from customers')).toEqual([{ name: 'A' }]);
  });

  it('cannot insert rows owned by someone else or move a row to another owner', async () => {
    await expect(as(BOB, `insert into customers (owner_id, id, name, company, status) values ('${ALICE}', 'x', 'X', 'X', 'Lead')`)).rejects.toThrow(/row-level security/);
    await expect(as(ALICE, `update customers set owner_id = '${BOB}' where id = 'c1'`)).rejects.toThrow(/row-level security/);
  });

  it('upsert on (owner_id, id) updates in place and bumps updated_at', async () => {
    const [before] = await as(ALICE, `select updated_at from customers where id = 'c1'`);
    await new Promise(r => setTimeout(r, 10));
    await as(ALICE, `insert into customers (id, name, company, status) values ('c1', 'A2', 'Acme', 'Prospect')
      on conflict (owner_id, id) do update set name = excluded.name, status = excluded.status`);
    const [after] = await as(ALICE, `select name, status, updated_at from customers where id = 'c1'`);
    expect(after.name).toBe('A2');
    expect(after.status).toBe('Prospect');
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime());
  });

  it('rejects invalid status and anonymous access', async () => {
    await expect(as(ALICE, `insert into customers (id, name, company, status) values ('bad', 'A', 'A', 'Won')`)).rejects.toThrow(/check constraint/);
    await db.exec('set role anon;');
    await expect(db.query('select * from customers')).rejects.toThrow(/permission denied/);
    await db.exec('reset role;');
  });

  it('stores an impossible due date without failing the write', async () => {
    await as(ALICE, `insert into customers (id, name, company, status, next_action) values ('d1', 'D', 'D', 'Lead', '{"description":"x","dueDate":"2026-13-45"}')`);
    const [row] = await as(ALICE, `select next_action_due from customers where id = 'd1'`);
    expect(row.next_action_due).toBeNull();
  });
});

describe('server-only tables', () => {
  it('are invisible to signed-in users', async () => {
    await expect(as(ALICE, 'select * from google_tokens')).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, 'select * from ai_usage')).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, `select public.consume_ai_quota('${ALICE}', 5)`)).rejects.toThrow(/permission denied/);
  });

  it('consume_ai_quota enforces the daily limit', async () => {
    await db.exec('set role service_role;');
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push((await db.query<{ ok: boolean }>(`select public.consume_ai_quota('${BOB}', 2) as ok`)).rows[0].ok);
    }
    await db.exec('reset role;');
    expect(results).toEqual([true, true, false]);
  });
});
