create table if not exists users
(
    id uuid default gen_random_uuid() not null
        primary key,
    full_name     varchar(100)                                       not null,
    phone_number  varchar(15)                                        not null
        unique,
    email         varchar(100)
        unique,
    password_hash varchar(255)                                       not null,
    role          varchar(20)              default 'passenger'::character varying,
    created_at    timestamp with time zone default CURRENT_TIMESTAMP,
    updated_at    timestamp with time zone default CURRENT_TIMESTAMP
);



create table if not exists buses
(
    id            uuid                     default gen_random_uuid() not null
        primary key,
    plate_numbers varchar(15)                                        not null
        unique,
    bus_type      varchar(50),
    capacity      integer                                            not null,
    is_active     boolean                  default true,
    created_at    timestamp with time zone default CURRENT_TIMESTAMP,
    updated_at    timestamp with time zone default CURRENT_TIMESTAMP
);



create table if not exists routes
(
    id         uuid                     default gen_random_uuid() not null
        primary key,
    route_code varchar(20)                                        not null
        unique,
    name       varchar(100)                                       not null,
    is_active  boolean                  default true,
    created_at timestamp with time zone default CURRENT_TIMESTAMP,
    updated_at timestamp with time zone default CURRENT_TIMESTAMP
);



create table if not exists stops
(
    id         uuid                     default gen_random_uuid() not null
        primary key,
    name       varchar(100)                                       not null,
    latitude   numeric(10, 8)                                     not null,
    longtitude numeric(10, 8)                                     not null,
    is_active  boolean                  default true,
    created_at timestamp with time zone default CURRENT_TIMESTAMP,
    updated_at timestamp with time zone default CURRENT_TIMESTAMP,
    geom       geography(Point, 4326)
);


create index if not exists idx_stops_name
    on stops (name);



create table if not exists route_stops
(
    id                           uuid    default gen_random_uuid() not null
        primary key,
    route_id                     uuid                              not null
        references routes
            on delete cascade,
    stop_id                      uuid                              not null
        references stops
            on delete cascade,
    stop_order                   integer                           not null,
    estimated_minutes_from_start integer default 0,
    unique (route_id, stop_id),
    unique (route_id, stop_order)
);



create table if not exists trips
(
    id               uuid                     default gen_random_uuid() not null
        primary key,
    bus_id           uuid                                               not null
        references buses
            on delete cascade,
    route_id         uuid                                               not null
        references routes
            on delete cascade,
    departure_time   timestamp with time zone                           not null,
    arrival_time     timestamp with time zone,
    status           varchar(20)              default 'scheduled'::character varying,
    current_capacity integer                                            not null,
    created_at       timestamp with time zone default CURRENT_TIMESTAMP
);


create index if not exists idx_trips_departure_time
    on trips (departure_time);

create index if not exists idx_trips_route_id
    on trips (route_id);



create table if not exists bookings
(
    id              uuid                     default gen_random_uuid() not null
        primary key,
    user_id         uuid                                               not null
        references users,
    trip_id         uuid                                               not null
        references trips,
    seat_number     integer,
    status          varchar(20)              default 'pending'::character varying,
    pickup_stop_id  uuid
        references stops,
    dropoff_stop_id uuid
        references stops,
    created_at      timestamp with time zone default CURRENT_TIMESTAMP
);



create table if not exists payments
(
    id              uuid        default gen_random_uuid() not null
        primary key,
    booking_id      uuid                                  not null
        references bookings
            on delete cascade,
    amount          numeric(10, 2)                        not null,
    currency        varchar(3)  default 'RWF'::character varying,
    payment_method  varchar(20),
    transaction_ref varchar(100)
        unique,
    status          varchar(20) default 'pending'::character varying,
    paid_at         timestamp with time zone
);



create table if not exists notifications
(
    id         uuid                     default gen_random_uuid() not null
        primary key,
    user_id    uuid                                               not null
        references users
            on delete cascade,
    title      varchar(255)                                       not null,
    message    text                                               not null,
    type       varchar(50),
    is_ready   boolean                  default false,
    created_at timestamp with time zone default CURRENT_TIMESTAMP
);



create table if not exists spatial_ref_sys
(
    srid      integer not null
        primary key
        constraint spatial_ref_sys_srid_check
            check ((srid > 0) AND (srid <= 998999)),
    auth_name varchar(256),
    auth_srid integer,
    srtext    varchar(2048),
    proj4text varchar(2048)
);


grant select on spatial_ref_sys to public;


