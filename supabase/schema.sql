create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  product text,
  url text,
  manual_price text,
  warranty text,
  risk text not null default '低' check (risk in ('低','中','高')),
  contact text,
  note text,
  card_format text,
  redeem_url text,
  status text not null default '在售' check (status in ('在售','空仓','停售')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_channels_category on channels(category);

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_channels_updated_at on channels;
create trigger trg_channels_updated_at
  before update on channels
  for each row execute function set_updated_at();

-- 行级安全:仅登录用户可读写,未登录拿不到任何行
alter table channels enable row level security;

drop policy if exists channels_authenticated_all on channels;
create policy channels_authenticated_all on channels
  for all
  to authenticated
  using (true)
  with check (true);
