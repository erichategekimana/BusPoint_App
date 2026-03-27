-- Connect to the database
\c buspoint_db;

-- 1. USERS
-- Inserting a passenger, an admin, and a driver
INSERT INTO users (id, full_name, phone_number, email, password_hash, role, company) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Eric Munyaneza', '0788123001', 'eric.m@example.com', 'hash123', 'passenger', NULL),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Alice Umutoni', '0788123002', 'alice.u@example.com', 'hash456', 'admin', 'Kigali Bus Services'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Jean Habimana', '0788123003', 'jean.h@example.com', 'hash789', 'driver', 'Kigali Bus Services');

-- 2. BUSES
-- Adding a Coaster and a large Yutong bus
INSERT INTO buses (id, plate_number, bus_type, capacity, company) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'RAA 100 A', 'Coaster', 30, 'Kigali Bus Services'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'RAB 200 B', 'Yutong', 70, 'Kigali Bus Services');

-- 3. ROUTES
-- Defining the Kimironko - Nyabugogo line
INSERT INTO routes (id, route_code, name) VALUES 
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', '101', 'Kimironko - Nyabugogo');

-- 4. STOPS
-- Geographic points across Kigali
-- Note: 'geom' is populated using the ST_GeographyFromText function
INSERT INTO stops (id, name, latitude, longitude, geom) VALUES 
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'Kimironko Park', -1.9360, 30.1260, ST_GeographyFromText('POINT(30.1260 -1.9360)')),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'Remera Giporoso', -1.9580, 30.1150, ST_GeographyFromText('POINT(30.1150 -1.9580)')),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 'Gishushu', -1.9530, 30.0940, ST_GeographyFromText('POINT(30.0940 -1.9530)')),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Nyabugogo Park', -1.9360, 30.0440, ST_GeographyFromText('POINT(30.0440 -1.9360)'));

-- 5. ROUTE_STOPS
-- Mapping the order of stops for Route 101
INSERT INTO route_stops (route_id, stop_id, stop_order, estimated_minutes_from_start) VALUES 
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 1, 0),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 2, 10),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 3, 25),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 4, 45);

-- 6. TRIPS
-- Assigning Bus RAA 100 A to Route 101 departing in 1 hour
INSERT INTO trips (id, bus_id, route_id, departure_time, status, current_capacity) VALUES 
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', NOW() + INTERVAL '1 hour', 'scheduled', 30);

-- 7. BOOKINGS
-- Eric books a seat from Remera to Nyabugogo
INSERT INTO bookings (id, user_id, trip_id, status, pickup_stop_id, dropoff_stop_id, ticket_token) VALUES 
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a61', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', 'confirmed', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'TK-KGL-101-001');

-- 8. PAYMENTS
-- Recording the 500 RWF MoMo payment
INSERT INTO payments (booking_id, amount, currency, payment_method, transaction_ref, status, paid_at) VALUES 
('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a61', 500.00, 'RWF', 'momo', 'TXN-MOMO-889900', 'completed', NOW());

-- 9. BUS_LOCATIONS
-- Setting initial live location for the bus at Kimironko
INSERT INTO bus_locations (bus_id, trip_id, latitude, longitude, speed, heading) VALUES 
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51', -1.9360, 30.1260, 0.0, 90.0);

-- 10. NOTIFICATIONS
INSERT INTO notifications (user_id, title, message, type, is_ready) VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Ticket Confirmed', 'Your seat for Route 101 is confirmed. Use QR code TK-KGL-101-001.', 'booking_success', true);