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
