-- 1. USERS (Creating a Passenger and a Driver)
INSERT INTO users (id, full_name, phone_number, email, password_hash, role) VALUES 
('11111111-0000-0000-0000-000000000001', 'Jean Claude Ndayisaba', '0788123456', 'jean.claude@example.com', 'hashed_password_123', 'passenger'),
('11111111-0000-0000-0000-000000000002', 'Marie Jeanne Mutoni', '0788654321', NULL, 'hashed_password_456', 'driver');

-- 2. BUSES (Creating a Coaster and a Yutong Bus)
INSERT INTO buses (id, plate_number, bus_type, capacity) VALUES 
('22222222-0000-0000-0000-000000000001', 'RAD 123 A', 'Coaster', 30),
('22222222-0000-0000-0000-000000000002', 'RAC 456 B', 'Yutong', 70);

-- 3. ROUTES (Creating the popular Nyabugogo to Kimironko route)
INSERT INTO routes (id, route_code, name) VALUES 
('33333333-0000-0000-0000-000000000001', '104', 'Nyabugogo - Kimironko');

-- 4. STOPS (Creating accurate GPS stops across Kigali)
INSERT INTO stops (id, name, latitude, longitude) VALUES 
('44444444-0000-0000-0000-000000000001', 'Nyabugogo Bus Park', -1.93600000, 30.04400000),
('44444444-0000-0000-0000-000000000002', 'Kinamba', -1.93800000, 30.06000000),
('44444444-0000-0000-0000-000000000003', 'Gishushu', -1.95300000, 30.09400000),
('44444444-0000-0000-0000-000000000004', 'Remera (Giporoso)', -1.95800000, 30.11500000),
('44444444-0000-0000-0000-000000000005', 'Kimironko Taxi Park', -1.93600000, 30.12600000);

-- 5. ROUTE_STOPS (Linking the stops to Route 104 in the correct order)
INSERT INTO route_stops (route_id, stop_id, stop_order, estimated_minutes_from_start) VALUES 
('33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 1, 0),   -- Starts at Nyabugogo
('33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002', 2, 10),  -- 10 mins to Kinamba
('33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000003', 3, 25),  -- 25 mins to Gishushu
('33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000004', 4, 35),  -- 35 mins to Remera
('33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000005', 5, 45);  -- 45 mins to Kimironko

-- 6. TRIPS (Scheduling the Coaster bus on Route 104)
-- Note: current_capacity starts at 30 (the max capacity of the Coaster)
INSERT INTO trips (id, bus_id, route_id, departure_time, arrival_time, status, current_capacity) VALUES 
('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', CURRENT_TIMESTAMP + INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '2 hours', 'scheduled', 30);

-- 7. BUS_LOCATIONS (The driver turned on the app at Nyabugogo)
INSERT INTO bus_locations (bus_id, trip_id, latitude, longitude, speed) VALUES 
('22222222-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', -1.93600000, 30.04400000, 0.0);

-- 8. BOOKINGS (Jean Claude books a seat from Kinamba to Kimironko)
INSERT INTO bookings (id, user_id, trip_id, status, pickup_stop_id, dropoff_stop_id) VALUES 
('66666666-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'confirmed', '44444444-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000005');

-- *Important Logic Step*: Because Jean Claude booked a seat, the backend must reduce the trip's capacity by 1.
UPDATE trips SET current_capacity = current_capacity - 1 WHERE id = '55555555-0000-0000-0000-000000000001';

-- 9. PAYMENTS (Jean Claude pays 500 RWF via MTN MoMo)
INSERT INTO payments (id, booking_id, amount, currency, payment_method, transaction_ref, status, paid_at) VALUES 
('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', 500.00, 'RWF', 'momo', 'MTN-123456789-TXN', 'completed', CURRENT_TIMESTAMP);

-- 10. NOTIFICATIONS (Sending a digital receipt to Jean Claude)
INSERT INTO notifications (user_id, title, message, type) VALUES 
('11111111-0000-0000-0000-000000000001', 'Payment Successful', 'Your booking for Route 104 to Kimironko is confirmed. MoMo Ref: MTN-123456789-TXN.', 'payment_success');
