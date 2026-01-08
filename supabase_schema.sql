-- Enable PostGIS for spatial queries (REQUIRED)
create extension if not exists postgis;

-- Create Tournaments Table
create table if not exists public.tournaments (
    tournament_id bigint primary key,
    name text not null,
    status text not null, -- 'active', 'upcoming', 'completed'
    start_local_date text,
    start_local_time text,
    organizer_name text,
    location_name text,
    address text,
    city text,
    state_province text,
    country text,
    latitude double precision,
    longitude double precision,
    description text,
    image_url text, -- For tournament avatar
    updated_at timestamp with time zone default now(),
    
    -- Geography column for fast "nearby" queries
    -- Point(Longitude, Latitude)
    location geography(Point, 4326)
);

-- Index for spatial search performance
create index if not exists tournaments_location_idx
  on public.tournaments
  using GIST (location);

-- Function to find nearby tournaments efficiently
-- Usage: select * from get_nearby_tournaments(LAT, LONG, RADIUS_METERS)
create or replace function get_nearby_tournaments(
    user_lat double precision,
    user_lon double precision,
    radius_meters double precision
)
returns setof public.tournaments
language sql
as $$
  select *
  from public.tournaments
  where st_dwithin(
    location,
    st_setsrid(st_makepoint(user_lon, user_lat), 4326)::geography,
    radius_meters
  )
  order by
    location <-> st_setsrid(st_makepoint(user_lon, user_lat), 4326)::geography;
$$;

-- Geocode Cache Table (for caching address -> coordinates lookups)
-- This avoids re-geocoding the same venue addresses on every sync
create table if not exists public.geocode_cache (
    address text primary key,
    latitude double precision not null,
    longitude double precision not null,
    created_at timestamp with time zone default now()
);

-- Index for faster lookups
create index if not exists geocode_cache_address_idx on public.geocode_cache (address);

-- OPDB Cache for full catalog search
create table if not exists opdb_machines (
  opdb_id text primary key,
  name text not null,
  manufacturer_name text,
  year text,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table opdb_machines enable row level security;

-- Policies (Public Read, Service Role Write)
create policy "Public machines are viewable by everyone"
  on opdb_machines for select
  using (true);

create policy "Service role can insert/update machines"
  on opdb_machines for insert
  with check (true);

create policy "Service role can update machines"
  on opdb_machines for update
  using (true);

-- Search Index
alter table opdb_machines add column if not exists search_vector tsvector
  generated always as (to_tsvector('english', name || ' ' || coalesce(manufacturer_name, ''))) stored;

create index if not exists machines_search_idx on opdb_machines using GIN (search_vector);

-- New Columns for List View Details
alter table opdb_machines add column if not exists type text;
alter table opdb_machines add column if not exists display text;
alter table opdb_machines add column if not exists player_count int;
alter table opdb_machines add column if not exists description text;
